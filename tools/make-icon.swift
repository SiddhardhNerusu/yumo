import AppKit
import CoreText
if CommandLine.arguments.count > 2 { CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: CommandLine.arguments[2]) as CFURL, .process, nil) }
let size = 1024.0
let img = NSImage(size: NSSize(width: size, height: size))
img.lockFocus()
NSColor(srgbRed: 0x4C/255.0, green: 0xC4/255.0, blue: 0x17/255.0, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: size, height: size)).fill()
let font = NSFont(name: "Nunito-Black", size: 600) ?? NSFont.systemFont(ofSize: 600, weight: .black)
let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.white]
let s = NSAttributedString(string: "y", attributes: attrs)
let b = s.size()
s.draw(at: NSPoint(x: (size - b.width) / 2, y: (size - b.height) / 2 + 40))
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
let png = rep.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
