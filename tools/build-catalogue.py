"""Builds Yumo/Resources/Catalogue/generic.json — Tier 1, the canonical generic foods (PRODUCT_BRIEF §2).
Sources (public domain / OGL): USDA FoodData Central SR Legacy (bulk CSV, tools/usda_sr_legacy), USDA Foundation Foods
(tools/fdc_foundation_p*.json, API list pages), and optionally UK CoFID (tools/cofid.csv when present).
Rules: one row per food + state; raw and cooked are separate entries; brand rows excluded; every row keeps a source_ref.
Curation overrides live in tools/curation.csv (source_id, display_name, state, aliases, approved, note) and win over the automatic names.
Run: python3 tools/build-catalogue.py   → prints a cross-check report (Atwater mismatch, duplicates) and writes the JSON."""
import csv, re, json, os, re, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "Yumo", "Resources", "Catalogue", "generic.json")
VERSION = "2026-10-21.3"

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
SHORTEN = [("separable lean and fat","lean and fat"),("separable lean only","lean only"),("separable fat","fat only"),("trimmed to 0\" fat","trimmed 0\" fat"),("trimmed to 1/8\" fat","trimmed 1/8\" fat"),("trimmed to 1/4\" fat","trimmed 1/4\" fat"),("meat and skin","meat and skin"),("meat only","meat only"),("without salt added",""),("with salt added","salted"),("without salt",""),("with salt","salted"),("boneless","boneless"),("skinless","skinless")]
# USDA files nuts and seeds under a category word first ("Nuts, almonds"); the name starts at the food and the category word stays
# searchable as an alias (20 Oct: "just say almonds"). Not fish: "Fish, salmon, chum" losing its prefix outranks the UK salmon rows.
USDA_PREFIXES = {"nuts", "seeds"}
# Nuts and seeds: the plain form is the bare name ("Almonds", "Walnuts"). These parts only restate it.
NUT_PLAIN_PARTS = {"kernel only", "kernels", "whole kernels", "whole", "halves", "plain", "unblanched", "unsalted", "shelled", "all types"}
SALT_PARTS = ("lightly salted", "salted")
STATE_WORDS = ("boiled in unsalted water","boiled in salted water","boiled","grilled","fried in corn oil","fried in sunflower oil","fried in rapeseed oil","fried in olive oil","fried","roast","roasted","baked","poached","steamed","stewed","microwaved","casseroled","barbecued","dried, raw","raw","cooked","roasted","grilled","boiled","baked","fried","braised","steamed","broiled","dry heat","moist heat","canned","dried","frozen","pasteurized","unenriched","enriched","drained","microwaved","stewed","simmered","pan-fried","pan-broiled","smoked","cured","toasted","uncooked","heated","unheated","prepared","drained solids","solids and liquids","unsweetened","sweetened")
JOIN_SECOND = {"breast","thigh","wing","drumstick","ground","loin","chuck","flank","round","rib","sirloin","tenderloin","fillet","white","whole","yolk","brown","black","wild","red","gold","russet","greek","plain","cottage","cheddar","mozzarella","feta","ricotta","atlantic","sockeye","navy","kidney","pinto","green","sweet","oat","wheat","rice","corn","shoulder","leg","top","bottom","eye","brisket","short","back","neck","liver","heart","skirt","hanger","porterhouse","t-bone","strip","filet","chops","belly","ham","bacon","spareribs","roast","steak","mince","breasts","thighs","wings","legs","heads","hearts","florets","tops","leaves","kernels","seeds","nuts","butter","milk","cream","cheese","yogurt","yoghurt"}

def clean(desc, usda=False, nut=False, seed=False):
    """→ (name, state, alias). `usda`: the row may lead with a category word. `nut` / `seed`: nuts and seeds, whose plain form is the bare name."""
    parts = [x.strip() for x in desc.split(",") if x.strip()]
    alias = ""
    if usda and len(parts) > 1 and parts[0].lower() in USDA_PREFIXES: alias = parts.pop(0).lower()
    parts = [p for p in parts if p.lower() not in DROP_PARTS]
    for a, b in SHORTEN: parts = [re.sub(re.escape(a), b, p, flags=re.I) for p in parts]
    parts = [p.strip() for p in parts]
    parts = [p for p in parts if p]
    if nut or seed:
        parts = [re.sub(r"\bseed kernels\b", "seeds", p, flags=re.I) for p in parts]
        # "whole" on a seed means the hull is on (whole pumpkin seeds vs kernels), so it stays; on a nut it means not flaked
        plain = NUT_PLAIN_PARTS - ({"whole"} if seed else set())
        parts = parts[:1] + [p for p in parts[1:] if p.lower() not in plain]
    # salt describes the food, not how it was cooked: set it aside so "dry roasted" is still read as the state
    salt = [p for p in parts[1:] if p.lower() in SALT_PARTS]
    parts = parts[:1] + [p for p in parts[1:] if p.lower() not in SALT_PARTS]
    state = []
    while len(parts) > 1 and any(w == parts[-1].lower() or parts[-1].lower().startswith(w + " ") or parts[-1].lower().endswith(" " + w) for w in STATE_WORDS): state.insert(0, parts.pop())
    # a bare state word in the middle ("Avocados, raw, all commercial varieties") is still the state
    for i, p in enumerate(parts[1:], 1):
        if p.lower() in ("raw", "cooked", "dry", "dried", "frozen", "canned") and len(parts) > 1:
            state.insert(0, parts.pop(i)); break
    if not (nut or seed) and len(parts) > 1 and len(parts[1]) <= 16 and not any(ch.isdigit() for ch in parts[1]) and parts[1].split()[0].lower() in JOIN_SECOND:   # "Walnuts, black", not "Walnuts black"
        parts = [parts[0] + " " + parts[1]] + parts[2:]
    name = ", ".join(parts + salt)
    name = name[0].upper() + name[1:] if name else name
    st = ", ".join(state).lower() or None
    if st:
        st = st.replace("cooked, ", "cooked (").replace("cooked,", "cooked (")
        if "(" in st and ")" not in st: st += ")"
    return name, st, alias

def load_renames():
    """tools/renames.csv (from, to): UK names for foods the sources spell differently ("Brazilnuts" → "Brazil nuts"), so the same food
    from two sources lands on one row. Applied to the start of the cleaned name, before a comma or the end."""
    p = os.path.join(HERE, "renames.csv")
    return [(r["from"], r["to"]) for r in csv.DictReader(open(p))] if os.path.exists(p) else []

def rename(name, renames):
    for a, b in renames:
        if name.lower() == a.lower() or name.lower().startswith(a.lower() + ","): return b + name[len(a):]
    return name

# Drinks are measured in ml (20 Oct). A row is a drink when the food itself is one — the part of the name before the first comma —
# and it isn't a powder or a dried form (a powder "made up with" milk or water is a drink).
DRINK = re.compile(r"milks?\b|\b(juice|drink|nectar|lassi|kefir|smoothie|shake)s?\b|coconut water", re.I)
NOT_DRINK = re.compile(r"\b(powder|dry|dried|cheese|milk chocolate|weighed as)\b", re.I)   # "weighed as whole fruit": per 100 g of fruit, not of juice
def is_drink(name, state):
    head = name.split(",")[0]
    if not DRINK.search(head): return False
    if re.search(r"yogh?urt", head, re.I) and not re.search(r"drink", head, re.I): return False   # "Yogurt whole milk" is a yogurt
    full = name + " " + (state or "")
    return not NOT_DRINK.search(full) or re.search(r"\bmade up\b", full, re.I) is not None

# g per ml, estimated from the row's own composition with the component densities of Choi & Okos (1986, 20 °C): semi-skimmed milk 1.03,
# orange juice 1.04, sweetened condensed milk 1.28. USDA's cup / fl oz weights are only the fallback — many are rounded label figures
# (a cup of juice as 236 g reads 1.00 when it is 1.04).
VOLUME_ML = {"fl oz": 29.5735, "cup": 236.588, "quart": 946.353, "tbsp": 14.787, "tablespoon": 14.787}
def composition_density(nut, src):
    w = nut.get("water_g")
    if w is None: return None
    p, f, c, alc = nut.get("p", 0), nut.get("f", 0), nut.get("c", 0), nut.get("alcohol_g", 0)
    fib = nut.get("fibre", 0)   # carbs exclude fibre on every row (converted for USDA)
    w = min(w, 100 - p - f - c - fib - alc)   # water and solids measured on different samples can add up past 100 g
    ash = max(0.0, 100 - w - p - f - c - fib - alc)
    vol = w / 0.9982 + p / 1.3199 + f / 0.9175 + c / 1.5991 + fib / 1.3115 + ash / 2.4238 + alc / 0.7893
    return 100 / vol if vol > 0 else None

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
        try: vol_amount = float(r["amount"] or 1)
        except ValueError: vol_amount = 0
        if label.lower() in VOLUME_ML and vol_amount > 0:   # a weighed volume: "1 cup = 244 g" → 1.031 g/ml
            f.setdefault("vol", {}).setdefault(label.lower(), float(r["gram_weight"]) / (vol_amount * VOLUME_ML[label.lower()]))
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
        vol = f.get("vol", {}); density = next((vol[u] for u in VOLUME_ML if u in vol), None)
        out.append({"src": "sr", "id": f"fdc:{fid}", "desc": f["desc"], "cat": f["cat"], "nut": f["nut"], "portions": portions[:3], "density": density, "source_ref": f"USDA SR Legacy {fid}"})
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

# tools/portions.csv (21 Oct): the everyday UK portion a row opens on when 100 g is not a serving anyone eats — nuts 30 g, cheese 30 g,
# oil 1 tbsp, dry rice 75 g (British Nutrition Foundation, Find Your Balance 2019). First matching rule wins; a row that already carries a
# counted unit ("1 medium", "1 slice", "1 scoop") keeps it. Drinks are in ml and never get one.
COUNTED = {"small","medium","large","extra","egg","slice","item","bar","biscuit","cookie","cracker","roll","bun","wrap","pot","can","bottle","sachet","scoop","tbsp","tsp","portion","serving","pack","packet","bag","tin","tub","stick","square","cube","sprig","clove","leaf","head","ear","pod","fruit","nut","date","fig","wedge","sheet","rasher","sausage","burger","patty"}
def load_portions():
    p = os.path.join(HERE, "portions.csv")
    return [r for r in csv.DictReader(open(p))] if os.path.exists(p) else []
def has_counted_unit(servings):
    for l, g in servings:
        if (l.endswith(" g") or l.endswith(" ml")) and not l.startswith("1 "): continue
        unit = re.sub(r"^1 ×? ?", "", l).split(" · ")[0].lower()
        if set(unit.split()) & COUNTED: return True
    return False
def portion_for(name, state, rules):
    n = name.lower(); st = (state or "").lower()
    for r in rules:
        if not re.search(r["match"], n): continue
        if r["exclude"] and re.search(r["exclude"], n + " " + st): continue
        if r["state"] and not re.search(r["state"], st): continue
        if not r["state"] and re.search(r"boiled|cooked|steamed|stewed", st) and r["kind"] in ("nuts and seeds", "oats raw"): continue
        return (r["label"], float(r["grams"]), r["kind"])
    return None

def default_servings(name):
    n = name.lower(); s = []
    if "egg whole" in n or n.startswith("egg, whole") or n == "egg": s.append(("1 large · 50 g", 50))
    elif "banana" in n: s.append(("1 medium · 118 g", 118))
    elif "chicken breast" in n: s.append(("1 breast · 174 g", 174))
    elif n.startswith("oats"): s.append(("80 g", 80))
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
        if re.search(r"homemade|takeaway|retail, |recipe|dish|pie|pasty|sausage roll|sandwich|burger|kebab|curry|casserole|stew|soup|sauce|dressing|pudding|cake|biscuit|pastry|crisps|chocolate|confectionery|dessert|mousse|trifle|crumble|flan|quiche|pizza|lasagne|bolognese|chilli|risotto|paella|nuggets|fingers|coated|battered|in batter|in breadcrumbs|weighed with|flesh only, weighed|bones|shells|skin and seeds", name, re.I): continue
        try: kcal = float(r["kcal"]); prot = float(r["p"])
        except: continue
        nut = {}
        for k in ("kcal","p","c","f","fibre","sugars","sat_fat","mono","poly","trans","alcohol_g","water_g","sodium_mg","potassium_mg","calcium_mg","magnesium_mg","phosphorus_mg","iron_mg","zinc_mg","selenium_ug","vit_a_ug","vit_d_ug","vit_e_mg","vit_k_ug","b1_mg","b2_mg","b3_mg","b6_mg","b12_ug","folate_ug","vit_c_mg","cholesterol_mg"):
            if r.get(k): nut[k] = float(r[k])
        # "flesh and skin" is how an apple or a pear is eaten — the plain row ("Apples, eating · raw"); "flesh only" marks the peeled one
        name = re.sub(r",\s*flesh and skin\b", "", name, flags=re.I)
        out.append({"src": "cofid", "id": f"cofid:{r['code']}", "desc": name, "cat": g, "nut": nut, "portions": [], "source_ref": f"UK CoFID {r['code']} (McCance & Widdowson 2021)",
                    "literature_only": bool(re.search(r"literature", r.get("description") or "", re.I)) and not re.search(r"sample|analys|calculat|manufacturer", r.get("description") or "", re.I)})
    return out

rows = sr_legacy() + foundation() + cofid()
cur = load_curation(); renames = load_renames(); portion_rules = load_portions()
RANK = {"cofid": 3, "foundation": 2, "sr": 1}   # same food + state in two sources: UK first (Sid, 21 Oct), then USDA Foundation, then SR Legacy
# ...unless the UK figure is only from literature and its energy is more than 40 % from USDA's analysis (shallots 20 vs 72 kcal,
# oyster mushrooms 8 vs 33): measured data beats a literature value that far off.
def uk_figure_doubtful(uk, us):
    return uk.get("literature_only") and us["nut"].get("kcal", 0) > 0 and abs(uk["nut"]["kcal"] - us["nut"]["kcal"]) / us["nut"]["kcal"] > 0.40
SOURCE = {"foundation": "usda_fdc_foundation", "sr": "usda_sr_legacy", "cofid": "cofid"}

def kind(r):
    """"nut" / "seed" / "" — nuts and seeds, whose plain form is just the name."""
    d = r["desc"]; head = d.split(",")[0].strip().lower()
    if r["src"] in ("sr", "foundation"):
        if head == "seeds": return "seed"
        if head in ("nuts", "peanuts") or r["cat"] == "Nut and Seed Products": return "nut"
        return ""
    if r["cat"].startswith("G"): return "seed" if "seed" in head else "nut"   # CoFID group G: nuts and seeds
    return ""

# pass 1 — names
report = collections.Counter(); named = []
for r in rows:
    nut = r["nut"]
    if "kcal" not in nut or "p" not in nut: report["no kcal/protein"] += 1; continue
    c = cur.get(r["id"])
    if c and c.get("approved", "").lower() in ("no", "0", "false", "drop"): report["dropped by curation"] += 1; continue
    k = kind(r)
    desc = re.sub(r"(\w)-roasted\b", r"\1 roasted", r["desc"]) if k else r["desc"]   # "dry-roasted" (legumes) = "dry roasted" (nuts)
    name, state, alias = clean(desc, usda=r["src"] != "cofid", nut=k == "nut", seed=k == "seed")
    name = rename(name, renames); aliases = alias
    if c: name = c.get("display_name") or name; state = c.get("state") or state; aliases = " ".join(x for x in (c.get("aliases", ""), alias) if x)
    named.append((r, k, name, state, aliases))

# a nut that a source lists both raw and dried (chestnuts, acorns, lotus seeds) keeps the state; otherwise raw / dried is the plain nut
raw_dried = collections.defaultdict(set)
for r, k, name, state, _ in named:
    if k and state in ("raw", "dried"): raw_dried[(r["src"], name.lower())].add(state)

# pass 2 — one row per food + state
out, seen, seen_rows = [], {}, {}
for r, k, name, state, aliases in named:
    nut = r["nut"]
    plain_ok = k and (r["src"] != "cofid" or re.search(r"nut|seed", name.split(",")[0], re.I))   # CoFID files quinoa with the nuts; it keeps "raw"
    if plain_ok and state in ("raw", "dried") and raw_dried[(r["src"], name.lower())] != {"raw", "dried"}: state = None
    key = (name + "|" + (state or "")).lower()
    if key in seen:
        prev_row, prev_src = seen[key]
        if r["src"] == "cofid" and uk_figure_doubtful(r, seen_rows[key]): report["kept USDA over a doubtful UK literature figure"] += 1; continue
        if RANK[r["src"]] > RANK[prev_src]: out.remove(prev_row); report["replaced by " + r["src"]] += 1
        else: report["duplicate name+state"] += 1; continue
    flags = []
    # UK convention for every row (Sid, 21 Oct: fibre is not a carb): carbs exclude fibre, energy = 4 P + 9 F + 3.75 C + 7 alcohol, fibre 0 —
    # which is how CoFID computes its own kcal (99 % of its rows within 3 %). USDA carbohydrate is "by difference" and includes fibre, and its
    # energy mixes factors; both are converted here. A USDA row with no fibre figure can't be converted and is flagged.
    if r["src"] != "cofid":
        if nut.get("fibre") is not None or nut.get("c", 0) < 0.5:   # no carbs (meat, fish, eggs, oils): nothing to subtract
            nut = dict(nut); nut["c"] = max(0.0, nut.get("c", 0) - nut.get("fibre", 0))
            nut["kcal"] = 4 * nut.get("p", 0) + 9 * nut.get("f", 0) + 3.75 * nut["c"] + 7 * nut.get("alcohol_g", 0)
            report["USDA rows converted to the UK convention"] += 1
        else: flags.append("fibre unknown"); report["USDA rows without a fibre figure (carbs may include fibre)"] += 1
    atw = 4 * nut.get("p", 0) + 9 * nut.get("f", 0) + 3.75 * nut.get("c", 0) + 7 * nut.get("alcohol_g", 0)
    if nut["kcal"] > 20 and abs(atw - nut["kcal"]) / max(1, nut["kcal"]) > 0.15 and "fibre unknown" not in flags: flags.append("atwater")
    density = (composition_density(nut, r["src"]) or r.get("density")) if is_drink(name, state) else None
    if density and not 0.9 <= density <= 1.35: density = None   # outside any drink's range: the row's numbers aren't per volume
    if density:   # drinks: amounts in ml, each weighing what that drink weighs (250 ml of semi-skimmed milk = 258 g)
        servings = [{"label": "100 ml", "grams": round(100 * density, 1)}, {"label": "250 ml", "grams": round(250 * density, 1)}]
        report["drinks in ml"] += 1
    else:
        servings = [{"label": l, "grams": g} for l, g in r["portions"]] + [{"label": l, "grams": g} for l, g in default_servings(name)]
        if not has_counted_unit([(x["label"], x["grams"]) for x in servings]):
            if (pt := portion_for(name, state, portion_rules)):
                servings.insert(0, {"label": pt[0], "grams": pt[1]}); report["portion: " + pt[2]] += 1
    labels = set(); dedup = []
    for s in servings:
        if s["label"] not in labels and 0 < s["grams"] <= 2000: labels.add(s["label"]); dedup.append(s)
    micros = {k2: round(v, 4) for k2, v in nut.items() if k2 not in ("kcal", "p", "c", "f")}
    row = {"id": r["id"], "name": name, "state": state, "aliases": aliases, "source": SOURCE[r["src"]], "source_ref": r["source_ref"],
           "kcal": round(nut["kcal"], 1), "p": round(nut.get("p", 0), 2), "c": round(nut.get("c", 0), 2), "f": round(nut.get("f", 0), 2), "servings": dedup[:4], "micros": micros, "flags": flags}
    if density: row["ml_density"] = round(density, 4)
    seen[key] = (row, r["src"]); seen_rows[key] = r; out.append(row)
    for fl in flags: report["flag:" + fl] += 1
out.sort(key=lambda x: (x["name"].lower(), x["state"] or ""))
import hashlib
json.dump({"version": VERSION + "." + hashlib.sha1(json.dumps(out, sort_keys=True).encode()).hexdigest()[:8], "foods": out}, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "generic foods written ·", dict(report))
