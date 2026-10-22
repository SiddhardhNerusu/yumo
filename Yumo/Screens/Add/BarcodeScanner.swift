import SwiftUI
import AVFoundation

/// AVFoundation barcode reader. EAN-8/13, UPC-A/E, Code 128. Reports each distinct code once per second.
struct BarcodeScannerView: UIViewControllerRepresentable {
    var torch: Bool; var onDenied: () -> Void = {}; var onCode: (String) -> Void
    func makeUIViewController(context: Context) -> ScannerVC { let vc = ScannerVC(); vc.onCode = onCode; vc.onDenied = onDenied; return vc }
    func updateUIViewController(_ vc: ScannerVC, context: Context) { vc.setTorch(torch) }
}
final class ScannerVC: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onCode: ((String) -> Void)?
    var onDenied: (() -> Void)?   // camera refused: the screen says so instead of staying black (22 Oct audit)
    private let session = AVCaptureSession(); private var preview: AVCaptureVideoPreviewLayer?
    private var last: (String, Date)?
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .black
        AVCaptureDevice.requestAccess(for: .video) { ok in DispatchQueue.main.async { if ok { self.configure() } else { self.onDenied?() } } }
    }
    private func configure() {
        guard let device = AVCaptureDevice.default(for: .video), let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) else { return }
        session.addInput(input)
        let out = AVCaptureMetadataOutput(); guard session.canAddOutput(out) else { return }
        session.addOutput(out); out.setMetadataObjectsDelegate(self, queue: .main)
        out.metadataObjectTypes = [.ean8, .ean13, .upce, .code128].filter { out.availableMetadataObjectTypes.contains($0) }
        let p = AVCaptureVideoPreviewLayer(session: session); p.videoGravity = .resizeAspectFill; p.frame = view.bounds; view.layer.addSublayer(p); preview = p
        DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
    }
    override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); preview?.frame = view.bounds }
    override func viewWillDisappear(_ a: Bool) { super.viewWillDisappear(a); setTorch(false); session.stopRunning() }
    func metadataOutput(_ o: AVCaptureMetadataOutput, didOutput objs: [AVMetadataObject], from c: AVCaptureConnection) {
        guard let code = (objs.first as? AVMetadataMachineReadableCodeObject)?.stringValue else { return }
        if let l = last, l.0 == code, Date().timeIntervalSince(l.1) < 1 { return }
        last = (code, Date()); onCode?(code)
    }
    func setTorch(_ on: Bool) {
        guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else { return }
        guard let d = AVCaptureDevice.default(for: .video), d.hasTorch, (try? d.lockForConfiguration()) != nil else { return }
        d.torchMode = on ? .on : .off; d.unlockForConfiguration()
    }
}

/// Shown over the scanner when camera access was refused: what happened, how to change it, and the way round it.
struct CameraDeniedCard: View {
    var alternative: String; var onAlternative: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Yumo can't use the camera").font(.yumo.title).foregroundStyle(Color.yumo.ink)
            Text("Camera access is off for Yumo. Turn it on in Settings to scan barcodes.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 10) {
                PrimaryButton(label: "Open Settings", size: .compact) { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } }
                SecondaryButton(label: alternative, action: onAlternative)
            }.padding(.top, 4)
        }
        .padding(20).background(RoundedRectangle(cornerRadius: Radius.found, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.found)
    }
}
