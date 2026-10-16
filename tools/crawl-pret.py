"""Snapshot Pret A Manger UK per-product nutrition from pret.co.uk product pages (their own published figures, embedded as __NEXT_DATA__).
Writes tools/chains/pret_<date>.json. Run: python3 tools/crawl-pret.py"""
import re, json, sys, time, urllib.request, datetime, os
HERE = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "Mozilla/5.0 (Macintosh) Yumo-catalogue-build"}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read().decode("utf-8", "ignore")
sm = get("https://www.pret.co.uk/en-GB/sitemap.xml")
urls = sorted(set(re.findall(r"https://www\.pret\.co\.uk/en-GB/products/UK\d+/[^<]+", sm)))
out, errs = [], []
for i, u in enumerate(urls):
    try:
        h = get(u)
        m = re.search(r'<script id="__NEXT_DATA__" type="application/json"[^>]*>(.*?)</script>', h, re.S)
        p = json.loads(m.group(1))["props"]["pageProps"].get("product") or {}
        nd = (p.get("nutritionalData") or [{}])[0]
        if not nd: errs.append(u + " no nutrition"); continue
        def v(k, which="perServing"):
            x = nd.get(k, {}).get(which); 
            try: return float(x)
            except: return None
        serving = p.get("servingSize") or p.get("weight") or p.get("portionSize")
        cats = [c.get("name") for c in (p.get("categories") or []) if isinstance(c, dict)]
        out.append({"id": "pret:" + (p.get("sku") or u.split("/")[-2]), "name": p.get("name") or p.get("title"), "category": cats[0] if cats else None,
                    "serving_label": "1 item" + (f" · {serving}" if serving else ""), "serving_grams": None,
                    "kcal": v("Energy (KCal)"), "p": v("Protein"), "c": v("Carbohydrates"), "f": v("Fat"),
                    "micros": {"sat_fat": v("Saturates"), "sugars": v("Sugars"), "fibre": v("Dietary Fibre"), "sodium_mg": (v("Salt") or 0) * 400 if v("Salt") is not None else None},
                    "per100": {"kcal": v("Energy (KCal)", "per100g"), "p": v("Protein", "per100g"), "c": v("Carbohydrates", "per100g"), "f": v("Fat", "per100g")},
                    "url": u, "keys": sorted(p.keys())[:40] if i == 0 else None})
    except Exception as e: errs.append(f"{u} {e}")
    time.sleep(0.2)
today = datetime.date.today().isoformat()
json.dump({"captured": today, "source": "pret.co.uk product pages (__NEXT_DATA__ nutritionalData)", "items": out, "errors": errs}, open(os.path.join(HERE, "chains", f"pret_{today}.json"), "w"), indent=0, ensure_ascii=False)
print(len(out), "pret items,", len(errs), "errors"); print(out[0]["keys"] if out else None)
