"""Builds Yumo/Resources/Catalogue/chains.json — Tier 2a, chain and restaurant items from each chain's OWN published nutrition data.
Nutrition facts are facts (not copyrightable); every item keeps a source_ref naming the chain's page/PDF and the capture date.
Rule: only what the chain publishes. Where a chain publishes kcal only (Nando's UK website), macros stay null and the app shows "—".
Sources are snapshots in tools/chains/ so the build is reproducible. Run: python3 tools/build-chains.py"""
import re, json, os, html
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "Yumo", "Resources", "Catalogue", "chains.json")
items = []

def nandos():
    p = os.path.join(HERE, "chains", "nandos_menu_2026-10-16.html")
    if not os.path.exists(p): return
    h = open(p, encoding="utf-8", errors="ignore").read()
    for sec in re.finditer(r'<section class="menuSection[^"]*" id="section_([^"]+)"[^>]*>\s*<h2>(.*?)</h2>(.*?)</section>', h, re.S):
        sid, stitle, body = sec.group(1), re.sub(r"<[^>]+>", "", sec.group(2)).strip(), sec.group(3)
        blocks = re.split(r'(?=<button title="Open product description for )', body)
        for blk in blocks:
            m = re.match(r'<button title="Open product description for ([^"]+)">', blk)
            if not m: continue
            name = html.unescape(m.group(1)).strip()
            k = re.search(r'(\d{2,4})\s*kcal', blk)
            if not k: continue
            kcal = float(k.group(1))
            serves = re.search(r'Serves (\d+)(?:-(\d+))?', blk)
            label = "1 item" if not serves else f"1 item · serves {serves.group(0).split(' ', 1)[1]}"
            items.append({"id": f"nandos:{sid}:{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')}", "chain": "Nando's", "category": stitle, "name": name,
                          "serving_label": label, "serving_grams": None, "kcal": kcal, "p": None, "c": None, "f": None, "micros": None,
                          "source_ref": "Nando's UK menu (nandos.co.uk/food/menu) · 16 Oct 2026 · kcal only; macros not published online"})
nandos()

def greggs():
    """Greggs 'Nutritional Information (Guide only)', September 2026, greggs.com/nutrition → nutritional-information.pdf. Per 100 g and per portion; we store per portion."""
    p = os.path.join(HERE, "chains", "greggs_nutritional_information_2026-09.pdf")
    if not os.path.exists(p): return
    import pypdf
    text = "\n".join(pg.extract_text() for pg in pypdf.PdfReader(p).pages)
    num = re.compile(r"^-?\d+(\.\d+)?%?$")
    tokens = text.replace("\n", " ").split()
    i, name = 0, []
    while i < len(tokens):
        # a row = name words followed by 26 numeric tokens
        j = i
        while j < len(tokens) and num.match(tokens[j]): j += 1
        if j - i >= 26:
            n = [float(t.rstrip("%")) for t in tokens[i:i + 26]]
            nm = " ".join(name).strip()
            nm = re.sub(r"^(Shop|Hospital Shop|= Hospital Shop|Adults need around 2000kcal a day|\(HS\))\s*", "", nm).strip()
            nm = re.sub(r"\s*\(HS\)$", "", nm).strip()
            if nm and not nm.lower().startswith(("product name", "information correct", "portion size", "nutritional information")):
                portion, kcal_p, fat_p, sat_p, carb_p, sug_p, fib_p, prot_p, salt_p = n[0], n[4], n[7], n[10], n[13], n[16], n[19], n[21], n[24]
                unit = "ml" if re.search(r"\b(latte|americano|cappuccino|mocha|tea|coffee|lemonade|juice|water|milk|shake|smoothie|hot chocolate|flat white|espresso|cola|drink|squash|frappe|iced)\b", nm, re.I) else "g"
                items.append({"id": f"greggs:{re.sub(r'[^a-z0-9]+', '-', nm.lower()).strip('-')}", "chain": "Greggs", "category": None, "name": nm,
                              "serving_label": f"1 portion · {int(round(portion))} {unit}", "serving_grams": portion, "kcal": kcal_p, "p": prot_p, "c": carb_p, "f": fat_p,
                              "micros": {"sat_fat": sat_p, "sugars": sug_p, "fibre": fib_p, "sodium_mg": round(salt_p * 400, 1)},
                              "source_ref": "Greggs Nutritional Information guide · September 2026 (greggs.com/nutrition)"})
            name = []; i = j
        else:
            name.append(tokens[i]); i += 1
greggs()

def pret():
    """Pret A Manger UK — per-product figures from pret.co.uk product pages (snapshot by tools/crawl-pret.py). Serving grams derived from per-serving ÷ per-100 g kcal."""
    import glob
    files = sorted(glob.glob(os.path.join(HERE, "chains", "pret_*.json")))
    if not files: return
    d = json.load(open(files[-1])); day = d.get("captured", "")
    for it in d["items"]:
        if it["kcal"] is None or it["p"] is None: continue
        per = it.get("per100") or {}
        grams = round(it["kcal"] / per["kcal"] * 100) if per.get("kcal") else None
        items.append({"id": it["id"], "chain": "Pret A Manger", "category": it.get("category"), "name": it["name"],
                      "serving_label": f"1 item · {grams} g" if grams else "1 item", "serving_grams": grams, "kcal": it["kcal"], "p": it["p"], "c": it["c"], "f": it["f"],
                      "micros": {k: v for k, v in (it.get("micros") or {}).items() if v is not None},
                      "source_ref": f"Pret A Manger UK product page (pret.co.uk) · {day}"})
pret()

def mcdonalds():
    """McDonald's UK — per-item values from mcdonalds.com/gb product pages (their /dnaapp/itemDetails nutrition service), snapshot in tools/chains/mcdonalds_uk_*.json."""
    import glob
    files = sorted(glob.glob(os.path.join(HERE, "chains", "mcdonalds_uk_*.json")))
    if not files: return
    d = json.load(open(files[-1])); day = d.get("captured", "")
    for it in d["items"]:
        n = it.get("n") or {}
        def f(k):
            try: return float(str(n.get(k, "")).replace(",", "."))
            except: return None
        kcal = f("energy_kcal")
        if not kcal or kcal <= 0 or not it.get("name"): continue
        serving = (it.get("serving") or "").strip()
        grams = None
        m = re.search(r"(\d+(?:\.\d+)?)\s*(g|ml)", serving)
        if m: grams = float(m.group(1))
        cat = (it.get("cats") or [None])[0]
        items.append({"id": f"mcdonalds:{it['id']}", "chain": "McDonald's", "category": cat, "name": it["name"].replace("®", "").strip(),
                      "serving_label": f"1 item · {serving}" if serving else "1 item", "serving_grams": grams, "kcal": kcal, "p": f("protein"), "c": f("carbohydrate"), "f": f("fat"),
                      "micros": {k: v for k, v in {"sat_fat": f("saturated_fat"), "sugars": f("sugars"), "fibre": f("fibre"), "sodium_mg": (f("salt") * 400) if f("salt") is not None else None}.items() if v is not None},
                      "source_ref": f"McDonald's UK nutrition data (mcdonalds.com/gb) · {day}"})
mcdonalds()

def starbucks():
    """Starbucks UK — Nutrition & Allergen Guide PDFs (food Autumn 2026 v04 dated 05/10/26; beverages Autumn 2026 v04 dated 18/09/26), starbucks.co.uk/nutrition."""
    import pypdf
    for fname, label in (("starbucks_food_2026-10.pdf", "Food guide · 5 Oct 2026"), ("starbucks_bev_2026-09.pdf", "Beverage guide · 18 Sep 2026")):
        p = os.path.join(HERE, "chains", fname)
        if not os.path.exists(p): continue
        text = " ".join(pg.extract_text() for pg in pypdf.PdfReader(p).pages).replace("\n", " ")
        for row in re.findall(r"([A-Z][^|]{2,120}?)\s+(Y|N)\s+(Y|N)\s+(.*?)\s((?:-?\d+(?:\.\d+)?\s+){8}-?\d+(?:\.\d+)?)", text, re.S):
            words = row[0].split()
            while words and (words[0].isupper() and len(words[0]) > 1 or words[0] in ("&",) or words[0].endswith(",")): words.pop(0)
            name = " ".join(words).strip(" -|")
            if not name or "---" in name or name.lower().startswith(("bakery", "product", "seasonal menu", "version", "adults need")): continue
            nums = [float(x) for x in row[4].split()]
            kj, kcal, fat, sat, carb, sug, fib, prot, salt = nums
            if kcal <= 0: continue
            items.append({"id": f"starbucks:{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')}", "chain": "Starbucks", "category": None, "name": name,
                          "serving_label": "1 item", "serving_grams": None, "kcal": kcal, "p": prot, "c": carb, "f": fat,
                          "micros": {"sat_fat": sat, "sugars": sug, "fibre": fib, "sodium_mg": round(salt * 400, 1)},
                          "source_ref": f"Starbucks UK Nutrition & Allergen {label} (starbucks.co.uk/nutrition)"})
starbucks()

def starbucks_beverages():
    """Starbucks UK beverage guide: each product lists sizes (Short/Tall/Grande/Venti…) with kJ, kcal, fat, sat, carb, sugars, fibre, protein, salt, caffeine."""
    import pypdf, logging
    logging.getLogger("pypdf").setLevel(logging.ERROR)
    p = os.path.join(HERE, "chains", "starbucks_bev_2026-09.pdf")
    if not os.path.exists(p): return
    text = " ".join(pg.extract_text() for pg in pypdf.PdfReader(p).pages).replace("\n", " ")
    pat = re.compile(r"\b(Short|Tall|Grande|Venti|Trenta|Solo|Doppio|Triple|Quad|Single|Double)\s+((?:-?\d+(?:\.\d+)?\s+){9}-?\d+(?:\.\d+)?)")
    last_end, last_name = 0, None
    for m in pat.finditer(text):
        seg = text[last_end:m.start()]
        last_end = m.end()
        pre = seg.split("[")[0]
        pre = re.sub(r"Allergen Update:.*?information\.", " ", pre)
        pre = re.sub(r"\|\s*Nutrition & Allergen Guide\s*\|\s*Beverages\s*\|\s*[A-Za-z &®]+", " ", pre)
        words = [w for w in pre.split() if not (w.isupper() and len(w) > 1)]
        # the ingredient list starts by repeating the milk / base; drop a trailing phrase that repeats an earlier one
        name = " ".join(words).strip(" -")
        if name:
            low = name.lower().split(" - ")
            if len(low) >= 2 and low[-1].strip() and low[-1].strip() in low[-2]: name = " - ".join(name.split(" - ")[:-1])
            for cut in (" skimmed milk skimmed", " semi-skimmed milk semi-skimmed", " whole milk whole", " oat drink oat", " soya drink soya", " almond drink almond", " coconut drink coconut"):
                if cut in name.lower(): i = name.lower().index(cut) + len(cut.rsplit(" ", 1)[0]); name = name[:i]; break
            name = re.sub(r"\s+", " ", name).strip(" -")
            name = re.sub(r"\((Standard|Lite|Light|Classic) Build\)", "", name, flags=re.I).strip()
            name = re.sub(r"\b(Ice|Water|Whipped cream|Cold foam)\b,?\s*$", "", name, flags=re.I).strip(" ,-")
            name = re.sub(r"\s+Ice,?$", "", name).strip(" ,-")
            ws = name.split()
            for k in range(len(ws) // 2, 0, -1):   # drop a trailing phrase that repeats an earlier one ("… - whole milk Whole milk")
                if " ".join(ws[-k:]).lower() in " ".join(ws[:-k]).lower(): ws = ws[:-k]; break
            name = " ".join(ws).strip(" -")
            if 3 <= len(name) <= 80 and not re.search(r"\d", name) and not name.lower().startswith(("version", "for allergens", "seasonal |", "product ingredients", "allergen", "please")): last_name = name
        if not last_name: continue
        nums = [float(x) for x in m.group(2).split()]
        kj, kcal, fat, sat, carb, sug, fib, prot, salt, caff = nums
        if kcal <= 0: continue
        nm = f"{last_name} ({m.group(1)})"
        items.append({"id": f"starbucks:{re.sub(r'[^a-z0-9]+', '-', nm.lower()).strip('-')}", "chain": "Starbucks", "category": "Beverages", "name": nm,
                      "serving_label": f"1 {m.group(1)}", "serving_grams": None, "kcal": kcal, "p": prot, "c": carb, "f": fat,
                      "micros": {"sat_fat": sat, "sugars": sug, "fibre": fib, "sodium_mg": round(salt * 400, 1), "caffeine_mg": caff},
                      "source_ref": "Starbucks UK Nutrition & Allergen Beverage guide · 18 Sep 2026 (starbucks.co.uk/nutrition)"})
starbucks_beverages()

def costa():
    """Costa Coffee UK — in-store nutrition & allergen guide (Autumn 2026, 27 Aug – 21 Oct), costa.co.uk/sustainability/nutrition. Rows carry per-100 g and per-portion values; we store per portion."""
    import pypdf, logging
    logging.getLogger("pypdf").setLevel(logging.ERROR)
    p = os.path.join(HERE, "chains", "costa_store_guide_autumn_2026.pdf")
    if not os.path.exists(p): return
    seen = set()
    for pg in pypdf.PdfReader(p).pages:
        t = pg.extract_text() or ""
        if "Nutrition per portion" not in t: continue
        t = re.sub(r"(\d) \.(\d)", r"\1.\2", t)          # "0 .08" → "0.08"
        lines = [l.strip() for l in t.split("\n") if l.strip()]
        pending = []
        for line in lines:
            m = re.match(r"^(.*?)((?:\s+-?\d+(?:\.\d+)?){17,19})\s*$", line)
            if not m:
                if re.search(r"[A-Za-z]", line) and not re.search(r"per 100g|per portion|Product Description|Portion Weight|ADULTS|Nutrition per|Energy -|Sats|Carb|Sugar|Fibre|Protein|Salt|Fat per|^\d+$", line): pending.append(line)
                continue
            head = (" ".join(pending + [m.group(1)])).strip()
            pending = []
            nums = [float(x) for x in m.group(2).split()]
            # drop leading section headings (≤ 2 words on their own)
            parts = head.split(); 
            while len(parts) > 3 and parts[0] in ("BREAKFAST", "MEALS", "PANINIS", "PASTRIES", "MATCHA", "S", "SANDWICHES", "SALADS", "SNACKS", "CAKES", "COOKIES", "MUFFINS", "WRAPS", "TOASTIES", "PORRIDGE", "FRAPPÉ", "FRAPPE", "HOT", "COLD", "ICED", "TEA", "COFFEE", "HOT CHOCOLATE", "SEASONAL", "KIDS", "BAKES"): parts.pop(0)
            name = " ".join(parts)
            name = re.sub(r"^.*?(?:Portion\s+)+", "", name)            # header leakage "Fat (G/Ml) Portion Portion …"
            name = re.sub(r"^.*?(?:per portion|per 100g|Salt per)\s+", "", name, flags=re.I)
            name = re.sub(r"\s+", " ", name).strip(" -")
            if not name or len(name) > 110: continue
            if re.fullmatch(r"(SKIMMED|SEMI-SKIMMED|WHOLE|OAT|SOYA|COCONUT|ALMOND) (MILK|DRINK)( - (SMALL|MEDIUM|LARGE|REGULAR))?( - (IN STORE|TAKE ?AWAY))?", name): continue   # wrapped line lost its product; left for curation
            if len(nums) == 19: per = nums[10:]; portion = nums[9]; kcal, fat, sat, carb, sug, fib, prot, salt = per[1], per[2], per[3], per[4], per[5], per[6], per[7], per[8]
            elif len(nums) == 17: per = nums[9:]; portion = nums[8]; kcal, fat, sat, carb, sug, prot, salt = per[1], per[2], per[3], per[4], per[5], per[6], per[7]; fib = None
            else: continue
            if kcal <= 0: continue
            disp = name.title().replace("'S", "'s").replace(" - ", " · ").replace("Gf ", "GF ").replace("Ptn", "portion")
            key = disp.lower()
            if key in seen: continue
            seen.add(key)
            micros = {"sat_fat": sat, "sugars": sug, "sodium_mg": round(salt * 400, 1)}
            if fib is not None: micros["fibre"] = fib
            unit = "ml" if re.search(r"latte|cappuccino|americano|flat white|mocha|hot chocolate|tea|frapp|cooler|lemonade|juice|smoothie|coffee|macchiato|espresso|cortado|babyccino|milk|drink|iced|cold brew|chai", name, re.I) else "g"
            items.append({"id": f"costa:{re.sub(r'[^a-z0-9]+', '-', key).strip('-')}", "chain": "Costa Coffee", "category": None, "name": disp,
                          "serving_label": f"1 portion · {int(round(portion))} {unit}", "serving_grams": portion, "kcal": kcal, "p": prot, "c": carb, "f": fat, "micros": micros,
                          "source_ref": "Costa Coffee in-store nutrition & allergen guide · Autumn 2026 (costa.co.uk)"})
costa()

def subway():
    """Subway UK & ROI — 'Nutrition Information September 2026' (subway.com/en-GB/MenuNutrition/Nutrition). Per serving (6-inch sub = bread + protein + salad veg) and per 100 g; stored per serving.
    The PDF prints section headings after their rows, so sections are not inferred; the serving weight disambiguates same-named rows."""
    import pypdf, logging
    logging.getLogger("pypdf").setLevel(logging.ERROR)
    p = os.path.join(HERE, "chains", "subway_uk_2026-09.pdf")
    if not os.path.exists(p): return
    seen = set()
    for pg in pypdf.PdfReader(p).pages:
        for line in (pg.extract_text() or "").split("\n"):
            m = re.match(r"^(.*?)((?:\s+-?\d+(?:\.\d+)?){20})\s*$", line.strip())
            if not m: continue
            name = re.sub(r"\s+", " ", m.group(1)).strip().rstrip("(").strip()
            if not name: continue
            n = [float(x) for x in m.group(2).split()]
            serving, kcal, fat, sat, carb, sug, fib, prot, salt = n[0], n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9]
            if kcal <= 0: continue
            key = f"{name.lower()}|{int(serving)}"
            if key in seen: continue
            seen.add(key)
            items.append({"id": f"subway:{re.sub(r'[^a-z0-9]+', '-', key).strip('-')}", "chain": "Subway", "category": None, "name": f"{name} ({int(serving)} g)",
                          "serving_label": f"1 serving · {int(serving)} g", "serving_grams": serving, "kcal": kcal, "p": prot, "c": carb, "f": fat,
                          "micros": {"sat_fat": sat, "sugars": sug, "fibre": fib, "sodium_mg": round(salt * 400, 1)},
                          "source_ref": "Subway UK & ROI Nutrition Information · September 2026 (subway.com) · 6-inch = bread + protein + onions, cucumber, lettuce"})
subway()

def kfc():
    """KFC UK & Ireland — kfc.co.uk/nutrition-allergens (the page embeds every product's published nutrition per item). Snapshot in tools/chains/kfc_uk_*.json."""
    import glob
    files = sorted(glob.glob(os.path.join(HERE, "chains", "kfc_uk_*.json")))
    if not files: return
    d = json.load(open(files[-1])); day = d.get("captured", "")
    for it in d["items"]:
        n = it.get("nutrition") or {}
        def f(k):
            try: return float(n.get(k)) if n.get(k) not in (None, "") else None
            except: return None
        kcal = f("kcal"); name = (it.get("name") or "").strip()
        if not kcal or kcal <= 0 or not name: continue
        ss = (n.get("serving_size") or "1").strip()
        label = "1 item" if ss in ("1", "") else f"1 {ss.replace('per ', '')}"
        if ss == "per 100ml": label = "100 ml"
        items.append({"id": f"kfc:{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')}", "chain": "KFC", "category": (it.get("categories") or [None])[0], "name": name,
                      "serving_label": label, "serving_grams": 100 if ss == "per 100ml" else None, "kcal": kcal, "p": f("protein"), "c": f("carbohydrates"), "f": f("fat"),
                      "micros": {k: v for k, v in {"sat_fat": f("saturated_fat"), "sugars": f("sugars"), "sodium_mg": (f("salt") * 400) if f("salt") is not None else None}.items() if v is not None},
                      "source_ref": f"KFC UK nutrition & allergen information (kfc.co.uk) · {day}"})
kfc()
# de-dup by id
seen, out = set(), []
for it in items:
    if it["id"] in seen: continue
    seen.add(it["id"]); out.append(it)
import hashlib
version = "2026-10-16." + hashlib.sha1(json.dumps(out, sort_keys=True).encode()).hexdigest()[:8]
json.dump({"version": version, "items": out}, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
import collections
print(len(out), "chain items ·", dict(collections.Counter(i["chain"] for i in out)))
for i in out[:12]: print(" ", i["category"], "·", i["name"], i["kcal"])
