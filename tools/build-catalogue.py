"""Builds Yumo/Resources/Catalogue/generic.json — Tier 1, the canonical generic foods (PRODUCT_BRIEF §2).
Sources (public domain / OGL): USDA FoodData Central SR Legacy (bulk CSV, tools/usda_sr_legacy), USDA Foundation Foods
(tools/fdc_foundation_p*.json, API list pages), and optionally UK CoFID (tools/cofid.csv when present).
Rules: one row per food + state; raw and cooked are separate entries; brand rows excluded; every row keeps a source_ref.
Curation overrides live in tools/curation.csv (source_id, display_name, state, aliases, approved, note) and win over the automatic names.
Run: python3 tools/build-catalogue.py   → prints a cross-check report (Atwater mismatch, duplicates) and writes the JSON."""
import csv, re, json, os, re, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "Yumo", "Resources", "Catalogue", "generic.json")
VERSION = "2026-10-16.1"

# nutrient number -> Yumo key
NUT = {"208":"kcal","203":"p","205":"c","204":"f","291":"fibre","269":"sugars","606":"sat_fat","645":"mono","646":"poly","605":"trans",
       "601":"cholesterol_mg","307":"sodium_mg","306":"potassium_mg","301":"calcium_mg","303":"iron_mg","304":"magnesium_mg","309":"zinc_mg",
       "305":"phosphorus_mg","317":"selenium_ug","320":"vit_a_ug","401":"vit_c_mg","328":"vit_d_ug","323":"vit_e_mg","430":"vit_k_ug",
       "404":"b1_mg","405":"b2_mg","406":"b3_mg","415":"b6_mg","417":"folate_ug","418":"b12_ug","421":"choline_mg","255":"water_g","262":"caffeine_mg","221":"alcohol_g"}
KEEP_CATEGORIES = {"Dairy and Egg Products","Spices and Herbs","Fats and Oils","Poultry Products","Sausages and Luncheon Meats","Breakfast Cereals",
                   "Fruits and Fruit Juices","Pork Products","Vegetables and Vegetable Products","Nut and Seed Products","Beef Products",
                   "Finfish and Shellfish Products","Legumes and Legume Products","Lamb, Veal, and Game Products","Baked Products","Cereal Grains and Pasta"}
BRANDY = re.compile(r"\b[A-Z][A-Z'&-]{3,}\b|®|™|USDA Commodity|[Bb]abyfood|[Ss]chool lunch|\bNFS\b|[Ii]mitation|NS as to")
BRAND_WORDS = re.compile(r"\b(PILLSBURY|KRAFT|KELLOGG|GENERAL MILLS|QUAKER|POST|NABISCO|HORMEL|OSCAR MAYER|TYSON|MCDONALD|BURGER KING|KFC|SUBWAY|WENDY|TACO BELL|DOMINO|PIZZA HUT|CAMPBELL|HEINZ|NESTLE|MARS|HERSHEY|KEEBLER|MISSION|ARCHWAY|MARTHA WHITE|BETTY CROCKER|DUNCAN HINES|JIMMY DEAN|LOUIS RICH|BALLPARK|HEBREW NATIONAL|SILK|SO DELICIOUS|CHOBANI|YOPLAIT|DANNON|LAND O|SMART BALANCE|BENECOL|CRISCO|WESSON|MAZOLA|PAM|UNCLE BEN|MINUTE|RICE-A-RONI|LIPTON|ORTEGA|OLD EL PASO|GOYA|GREEN GIANT|BIRDS EYE|ORE-IDA|MORNINGSTAR|GARDENBURGER|BOCA|WORTHINGTON|LOMA LINDA|HOUSE FOODS|MORI-NU|NASOYA|VITASOY|FRANKLIN|GLUTINO|UDI|KING ARTHUR|GOLD MEDAL|PEPPERIDGE|ARNOLD|SARA LEE|WONDER|NATURE'S OWN|THOMAS|ENTENMANN|LITTLE DEBBIE|HOSTESS|DOLLY MADISON|TASTYKAKE|KASHI|NATURE VALLEY|CLIF|POWERBAR|SLIM-FAST|ENSURE|BOOST|CARNATION|OVALTINE|NESQUIK|SWISS MISS|HOT COCOA|GATORADE|POWERADE|RED BULL|MONSTER|ROCKSTAR|SNAPPLE|ARIZONA|TROPICANA|MINUTE MAID|OCEAN SPRAY|V8|CAPRI SUN|KOOL-AID|CRYSTAL LIGHT|TANG|HI-C|SUNNY D|COCA|PEPSI|SPRITE|DR PEPPER|MOUNTAIN DEW|SCHWEPPES|CANADA DRY|A&W|BARQ|FANTA|7UP|SIERRA MIST|STARBUCKS|DUNKIN|PANERA|CHICK-FIL-A|POPEYES|ARBY|SONIC|JACK IN THE BOX|CARL|HARDEE|WHATABURGER|IN-N-OUT|FIVE GUYS|SHAKE SHACK|CHIPOTLE|QDOBA|PANDA EXPRESS|P\.F\. CHANG|OLIVE GARDEN|RED LOBSTER|APPLEBEE|CHILI|TGI|OUTBACK|TEXAS ROADHOUSE|LONGHORN|CRACKER BARREL|DENNY|IHOP|WAFFLE HOUSE|BOB EVANS|PERKINS|GOLDEN CORRAL|CICI|LITTLE CAESARS|PAPA JOHN|PAPA MURPHY|ROUND TABLE|SBARRO|DIGIORNO|TOMBSTONE|RED BARON|TOTINO|CELESTE|STOUFFER|LEAN CUISINE|HEALTHY CHOICE|MARIE CALLENDER|BANQUET|HUNGRY-MAN|SWANSON|BIRDS|EGGO|AUNT JEMIMA|HUNGRY JACK|KRUSTEAZ|BISQUICK|JIFFY)\b", re.I)
DROP_PARTS = {"broilers or fryers","broiler or fryers","all classes","composite of trimmed retail cuts","all grades","choice","select","prime","usda","commercial","domestic","enhanced","raised in","year round","average of all","commodity","unprepared","prepared","home-prepared","home prepared","regular","plain","original","grade a","large","extra large","jumbo","medium"}
SHORTEN = [("separable lean and fat","lean and fat"),("separable lean only","lean only"),("separable fat","fat only"),("trimmed to 0\" fat","trimmed 0\" fat"),("trimmed to 1/8\" fat","trimmed 1/8\" fat"),("trimmed to 1/4\" fat","trimmed 1/4\" fat"),("meat and skin","meat and skin"),("meat only","meat only"),("without salt",""),("with salt","salted"),("boneless","boneless"),("skinless","skinless")]
STATE_WORDS = ("boiled in unsalted water","boiled in salted water","boiled","grilled","fried in corn oil","fried in sunflower oil","fried in rapeseed oil","fried in olive oil","fried","roast","roasted","baked","poached","steamed","stewed","microwaved","casseroled","barbecued","dried, raw","raw","cooked","roasted","grilled","boiled","baked","fried","braised","steamed","broiled","dry heat","moist heat","canned","dried","frozen","pasteurized","unenriched","enriched","drained","microwaved","stewed","simmered","pan-fried","pan-broiled","smoked","cured","toasted","uncooked","heated","unheated","prepared","drained solids","solids and liquids","unsweetened","sweetened")
JOIN_SECOND = {"breast","thigh","wing","drumstick","ground","loin","chuck","flank","round","rib","sirloin","tenderloin","fillet","white","whole","yolk","brown","black","wild","red","gold","russet","greek","plain","cottage","cheddar","mozzarella","feta","ricotta","atlantic","sockeye","navy","kidney","pinto","green","sweet","oat","wheat","rice","corn","shoulder","leg","top","bottom","eye","brisket","short","back","neck","liver","heart","skirt","hanger","porterhouse","t-bone","strip","filet","chops","belly","ham","bacon","spareribs","roast","steak","mince","breasts","thighs","wings","legs","heads","hearts","florets","tops","leaves","kernels","seeds","nuts","butter","milk","cream","cheese","yogurt","yoghurt"}

def clean(desc):
    parts = [x.strip() for x in desc.split(",") if x.strip()]
    parts = [p for p in parts if p.lower() not in DROP_PARTS]
    for a, b in SHORTEN: parts = [re.sub(re.escape(a), b, p, flags=re.I) for p in parts]
    parts = [p for p in parts if p]
    state = []
    while len(parts) > 1 and any(w == parts[-1].lower() or parts[-1].lower().startswith(w + " ") or parts[-1].lower().endswith(" " + w) for w in STATE_WORDS): state.insert(0, parts.pop())
    # a bare state word in the middle ("Avocados, raw, all commercial varieties") is still the state
    for i, p in enumerate(parts[1:], 1):
        if p.lower() in ("raw", "cooked", "dry", "dried", "frozen", "canned") and len(parts) > 1:
            state.insert(0, parts.pop(i)); break
    if len(parts) > 1 and len(parts[1]) <= 16 and not any(ch.isdigit() for ch in parts[1]) and parts[1].split()[0].lower() in JOIN_SECOND:
        parts = [parts[0] + " " + parts[1]] + parts[2:]
    name = ", ".join(parts)
    name = name[0].upper() + name[1:] if name else name
    st = ", ".join(state).lower() or None
    if st:
        st = st.replace("cooked, ", "cooked (").replace("cooked,", "cooked (")
        if "(" in st and ")" not in st: st += ")"
    return name, st

def load_curation():
    p = os.path.join(HERE, "curation.csv"); cur = {}
    if os.path.exists(p):
        for r in csv.DictReader(open(p)): cur[r["source_id"]] = r
    return cur

def sr_legacy():
    d = os.path.join(HERE, "usda_sr_legacy")
    if not os.path.isdir(d): return []
    cats = {r["id"]: r["description"] for r in csv.DictReader(open(os.path.join(d, "food_category.csv")))}
    nums = {r["id"]: r["nutrient_nbr"] for r in csv.DictReader(open(os.path.join(d, "nutrient.csv")))}
    foods = {}
    for r in csv.DictReader(open(os.path.join(d, "food.csv"))):
        cat = cats.get(r["food_category_id"], "")
        desc = r["description"]
        if cat not in KEEP_CATEGORIES: continue
        if BRANDY.search(desc) or BRAND_WORDS.search(desc): continue
        if re.search(r"\bwith salt\b", desc, re.I) and not re.search(r"\bbutter\b|\bnuts?\b|\bseeds?\b|\bpeanuts\b", desc, re.I): continue   # keep the unsalted vegetable row only
        if re.search(r"\b(dehydrated|freeze-dried|powder|concentrate|reconstituted|low sodium|reduced sodium|fortified|infant|toddler|undiluted|diluted|canned, regular pack|special dietary|lite|light|fat free|nonfat|reduced fat|low fat|lowfat)\b", desc, re.I) and cat not in ("Dairy and Egg Products",): continue
        # Noise the canonical set does not need: recipes, mixes, breaded/processed variants, regional imports, oils-as-supplements
        if re.search(r"prepared from recipe|dry mix|made with|includes|with added solution|added solution|breaded|battered|patty|patties|crumbles|loaf|nuggets|tenders|deli|luncheon|prepackaged|sliced, prepackaged|New Zealand|Australian|imported|Fish oil|oil, (cod|salmon|herring|menhaden|sardine)|ready-to-serve|ready-to-eat|restaurant|fast food|frozen, (prepared|heated|unprepared)|microwaved|puffs|fries|hash brown|tots|chips|crisps|sticks|dinner|entree|meal|casserole|stuffed|salad|sandwich|spread|dip|sauce|gravy|soup|syrup|frosting|icing|filling|topping|candies|candy|cookie|cake|pie|pastry|doughnut|donut|muffin|croissant|biscuit|waffle|pancake|cracker|bun|roll, sweet|danish|brownie|cheesecake|pudding|custard|mousse|dessert|pretzel|popcorn|granola bar|snack|toaster|pop-tart|coated|glazed|sweetened|flavored|flavoured|instant|quick, dry|regular and quick|seasoned|marinated|smoked, chopped|chopped, formed|pressed|loaf|spam|hot dog|frankfurter|bologna|salami|pepperoni|pastrami|corned|jerky|pate|liverwurst|head cheese|souse|blood|brains|tripe|tongue|kidneys|lungs|spleen|thymus|pancreas|mechanically separated|back fat|lard|tallow|shortening|drippings|suet|emu|bison|elk|moose|caribou|antelope|beaver|bear|muskrat|opossum|raccoon|squirrel|armadillo|whale|seal|walrus|game meat|ostrich|quail|pheasant|squab|dove|guinea|goose|duck, domesticated|capon|cornish|poussin|heart|liver|giblets|gizzard|neck|feet|tail|skin only|fat only|separable fat|mixed species|composite", desc, re.I): continue
        foods[r["fdc_id"]] = {"desc": desc, "cat": cat, "nut": {}, "portions": []}
    for r in csv.DictReader(open(os.path.join(d, "food_nutrient.csv"))):
        f = foods.get(r["fdc_id"]); 
        if not f: continue
        k = NUT.get(nums.get(r["nutrient_id"], ""))
        if k and r["amount"] not in ("", None): f["nut"][k] = float(r["amount"])
    for r in csv.DictReader(open(os.path.join(d, "food_portion.csv"))):
        f = foods.get(r["fdc_id"])
        if not f or not r["gram_weight"]: continue
        label = (r["modifier"] or r["portion_description"] or "serving").strip()
        amt = r["amount"] or "1"
        try: a = float(amt); amt = str(int(a)) if a == int(a) else str(a)
        except: pass
        f["portions"].append((f"{amt} {label} · {int(round(float(r['gram_weight'])))} g", float(r["gram_weight"])))
    out = []
    for fid, f in foods.items():
        # Default serving = the first portion. A piece ("1 medium", "1 large", "1 slice", "1 egg") must outrank a measure ("1 cup, mashed",
        # "1 tbsp", "1 oz"): type-to-log treats a bare small number as pieces only when the default serving is a piece.
        def piece_rank(p):
            l = p[0].lower()
            if re.search(r"\b(cup|cups|tbsp|tablespoon|tsp|teaspoon|oz|fl oz|ml|pint|quart|lb)\b", l): return 2
            if re.search(r"\b(medium|large|small|extra large|jumbo|piece|slice|each|unit|whole|egg|fillet|breast|thigh|leg|wing|drumstick|stick|bar|packet|can|container|bottle|serving|patty|link|chop|steak|fruit|pod|head|stalk|ear|leaf|sprig|clove|nut|wedge|ring|square|cookie|cracker|roll|bun|muffin|pancake|waffle|tortilla|pita)\b", l):
                return 0 if "medium" in l else (0.2 if "large" in l and "extra" not in l else (0.4 if "small" in l and "extra" not in l else 0.6))   # medium is the everyday piece
            return 1
        portions = sorted(f["portions"], key=piece_rank)
        out.append({"src": "sr", "id": f"fdc:{fid}", "desc": f["desc"], "cat": f["cat"], "nut": f["nut"], "portions": portions[:3], "source_ref": f"USDA SR Legacy {fid}"})
    return out

def foundation():
    out = []
    for p in ("fdc_foundation_p1.json", "fdc_foundation_p2.json"):
        fp = os.path.join(HERE, p)
        if not os.path.exists(fp): continue
        for f in json.load(open(fp)):
            nut = {}
            for n in f.get("foodNutrients", []):
                k = NUT.get(str(n.get("number")))
                if k and n.get("amount") is not None: nut[k] = float(n["amount"])
            if BRANDY.search(f["description"]) or BRAND_WORDS.search(f["description"]) or re.search(r"Restaurant|fast food|Cookies|Pizza|Chinese|Frankfurter|Sausage|Nuggets|Fries|Onion rings|Burger|Hot dog|Pop-tart|Toaster", f["description"], re.I): continue
            if "kcal" not in nut:
                for n in f.get("foodNutrients", []):
                    if str(n.get("number")) in ("957", "958") and n.get("amount") is not None: nut["kcal"] = float(n["amount"]); break
            out.append({"src": "foundation", "id": f"fdc:{f['fdcId']}", "desc": f["description"], "cat": "", "nut": nut, "portions": [], "source_ref": f"USDA FDC Foundation {f['fdcId']}"})
    return out

def default_servings(name):
    n = name.lower(); s = []
    if "egg whole" in n or n.startswith("egg, whole") or n == "egg": s.append(("1 large · 50 g", 50))
    elif "banana" in n: s.append(("1 medium · 118 g", 118))
    elif "chicken breast" in n: s.append(("1 breast · 174 g", 174))
    elif n.startswith("oats"): s.append(("80 g", 80))
    elif "milk" in n and "cheese" not in n and "chocolate" not in n: s = [("250 ml", 250), ("100 ml", 100)]
    elif n.startswith("oil") or ", oil" in n or "olive oil" in n: s.append(("1 tbsp · 14 g", 14))
    elif "apple" in n and "juice" not in n: s.append(("1 medium · 182 g", 182))
    elif "bread" in n: s.append(("1 slice · 36 g", 36))
    return s

def cofid():
    """UK CoFID 2021 (McCance & Widdowson, OGL v3). Groups by first letter: A cereals, B milk, C eggs, D vegetables, F fruit, G nuts, H herbs, J fish, M meat, O fats.
    Excludes recipe/dish groups (DR meat-free dishes, MR meat dishes, JR fish dishes, AM/AN composite cereal dishes) and anything homemade/takeaway."""
    fp = os.path.join(HERE, "cofid.csv")
    if not os.path.exists(fp): return []
    keep_first = set("ABCDFGHJMO"); drop_groups = {"DR", "MR", "JR", "AM", "AN", "AP", "MI", "MIG"}
    out = []
    for r in csv.DictReader(open(fp)):
        g = r["group"] or ""
        if not g or g[0] not in keep_first or g in drop_groups: continue
        name = r["name"]
        if re.search(r"homemade|takeaway|retail, |recipe|dish|pie|pasty|sausage roll|sandwich|burger|kebab|curry|casserole|stew|soup|sauce|dressing|pudding|cake|biscuit|pastry|crisps|chocolate|confectionery|dessert|mousse|trifle|crumble|flan|quiche|pizza|lasagne|bolognese|chilli|risotto|paella|nuggets|fingers|coated|battered|in batter|in breadcrumbs|weighed with|flesh and skin|flesh only, weighed|bones|shells|skin and seeds", name, re.I): continue
        try: kcal = float(r["kcal"]); prot = float(r["p"])
        except: continue
        nut = {}
        for k in ("kcal","p","c","f","fibre","sugars","sat_fat","mono","poly","trans","alcohol_g","water_g","sodium_mg","potassium_mg","calcium_mg","magnesium_mg","phosphorus_mg","iron_mg","zinc_mg","selenium_ug","vit_a_ug","vit_d_ug","vit_e_mg","vit_k_ug","b1_mg","b2_mg","b3_mg","b6_mg","b12_ug","folate_ug","vit_c_mg","cholesterol_mg"):
            if r.get(k): nut[k] = float(r[k])
        out.append({"src": "cofid", "id": f"cofid:{r['code']}", "desc": name, "cat": g, "nut": nut, "portions": [], "source_ref": f"UK CoFID {r['code']} (McCance & Widdowson 2021)"})
    return out

rows = sr_legacy() + foundation() + cofid()
cur = load_curation()
out, seen, report = [], {}, collections.Counter()
for r in rows:
    nut = r["nut"]
    if "kcal" not in nut or "p" not in nut: report["no kcal/protein"] += 1; continue
    c = cur.get(r["id"])
    if c and c.get("approved", "").lower() in ("no", "0", "false", "drop"): report["dropped by curation"] += 1; continue
    name, state = clean(r["desc"])
    aliases = ""
    if c:
        name = c.get("display_name") or name; state = c.get("state") or state; aliases = c.get("aliases", "")
    key = (name + "|" + (state or "")).lower()
    if key in seen:
        # Foundation (newer, better panels) wins over SR Legacy for the same food+state
        if r["src"] == "foundation" and seen[key]["source"] != "usda_fdc_foundation": out.remove(seen[key])
        else: report["duplicate name+state"] += 1; continue   # USDA wins over CoFID for the same food+state; CoFID fills UK gaps
    atw = 4 * nut.get("p", 0) + 4 * nut.get("c", 0) + 9 * nut.get("f", 0)
    flags = []
    if nut["kcal"] > 20 and abs(atw - nut["kcal"]) / max(1, nut["kcal"]) > 0.15 and nut.get("alcohol_g", 0) == 0 and nut.get("fibre", 0) < 10: flags.append("atwater")
    servings = [{"label": l, "grams": g} for l, g in r["portions"]] + [{"label": l, "grams": g} for l, g in default_servings(name)]
    labels = set(); dedup = []
    for s in servings:
        if s["label"] not in labels and 0 < s["grams"] <= 2000: labels.add(s["label"]); dedup.append(s)
    micros = {k: round(v, 4) for k, v in nut.items() if k not in ("kcal", "p", "c", "f")}
    row = {"id": r["id"], "name": name, "state": state, "aliases": aliases, "source": {"foundation": "usda_fdc_foundation", "sr": "usda_sr_legacy", "cofid": "cofid"}[r["src"]], "source_ref": r["source_ref"],
           "kcal": round(nut["kcal"], 1), "p": round(nut.get("p", 0), 2), "c": round(nut.get("c", 0), 2), "f": round(nut.get("f", 0), 2), "servings": dedup[:4], "micros": micros, "flags": flags}
    seen[key] = row; out.append(row)
    for fl in flags: report["flag:" + fl] += 1
out.sort(key=lambda x: (x["name"].lower(), x["state"] or ""))
import hashlib
json.dump({"version": VERSION + "." + hashlib.sha1(json.dumps(out, sort_keys=True).encode()).hexdigest()[:8], "foods": out}, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "generic foods written ·", dict(report))
