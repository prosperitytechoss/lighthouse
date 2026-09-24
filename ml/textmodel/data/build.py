import json
import random
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RAW = HERE / "raw"
RAW.mkdir(exist_ok=True)
LEXICON = ROOT / "apps/child/src/native/lexicon.json"
API = "https://datasets-server.huggingface.co"

rng = random.Random(1337)

CATS = ["Self-Harm", "Eating Disorders", "Sexual Content", "Violence", "Graphic Content", "Substance Use", "Hate Speech", "Gambling"]


def http_json(url: str, tries: int = 6):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "lighthouse-textmodel/1"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            last = e
            wait = 8.0 * (i + 1) if "429" in str(e) else 1.5 * (i + 1)
            time.sleep(wait)
    raise RuntimeError(f"failed {url}: {last}")


def cached(key: str, fn):
    p = RAW / f"{key}.jsonl"
    if p.exists():
        return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
    rows = fn()
    p.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    return rows


def rows_page(dataset: str, config: str, split: str, offset: int, length: int = 100):
    q = urllib.parse.urlencode({"dataset": dataset, "config": config, "split": split, "offset": offset, "length": length})
    return [r["row"] for r in http_json(f"{API}/rows?{q}")["rows"]]


def fetch_rows(dataset: str, config: str, split: str, n: int, start: int = 0):
    offsets = list(range(start, start + n, 100))
    with ThreadPoolExecutor(4) as ex:
        pages = list(ex.map(lambda o: rows_page(dataset, config, split, o, min(100, start + n - o)), offsets))
    return [r for p in pages for r in p]


def fetch_filter(dataset: str, config: str, split: str, where: str, n: int):
    out = []
    offset = 0
    while len(out) < n:
        q = urllib.parse.urlencode(
            {"dataset": dataset, "config": config, "split": split, "where": where, "offset": offset, "length": min(100, n - len(out))}
        )
        try:
            d = http_json(f"{API}/filter?{q}", tries=3)
        except Exception:
            return None
        rows = [r["row"] for r in d["rows"]]
        if not rows:
            break
        out.extend(rows)
        offset += len(rows)
    return out[:n]


def fetch_by_label(dataset: str, config: str, split: str, col: str, wanted: dict[str, int], total_rows: int):
    where_ok = True
    out: dict[str, list] = {k: [] for k in wanted}
    for label, n in wanted.items():
        got = fetch_filter(dataset, config, split, f'"{col}"=\'{label}\'', n) if where_ok else None
        if got is None:
            where_ok = False
            break
        out[label] = got
    if where_ok:
        return out
    print(f"  filter endpoint unavailable for {dataset}, probing label regions", file=sys.stderr)
    out = {k: [] for k in wanted}
    probe_step = 1000
    probes = list(range(0, total_rows, probe_step))
    with ThreadPoolExecutor(4) as ex:
        labels = list(ex.map(lambda o: str(rows_page(dataset, config, split, o, 1)[0].get(col)), probes))
    regions: dict[str, list[int]] = {}
    for o, lab in zip(probes, labels):
        regions.setdefault(lab, []).append(o)
    for label, n in wanted.items():
        starts = regions.get(label, [])
        rng.shuffle(starts)
        for st in starts:
            if len(out[label]) >= n:
                break
            page = fetch_rows(dataset, config, split, min(probe_step, total_rows - st), st)
            out[label].extend(r for r in page if str(r.get(col)) == label)
        out[label] = out[label][:n]
        if len(out[label]) < n:
            print(f"  {label}: only {len(out[label])}/{n}", file=sys.stderr)
    return out


def flatten(by_label: dict[str, list], col: str) -> list[dict]:
    return [{"label": k, "text": r[col]} for k, v in by_label.items() for r in v]


def clean(t: str, limit: int = 200) -> str:
    t = " ".join(str(t).replace("\n", " ").split())
    if len(t) > limit:
        cut = t[:limit]
        sp = cut.rfind(" ")
        t = cut[:sp] if sp > 80 else cut
    return t.strip()


TEMPLATES = {
    "en": [
        "{p}",
        "{p}",
        "bro {p}",
        "honestly {p} rn",
        "i swear {p} 😭",
        "{p} lol",
        "my guy said {p}",
        "{p}, don't tell anyone",
        "ngl {p} and idk what to do",
        "so yesterday {p}",
        "{p} tonight?",
        "guys {p} 😩",
        "can't lie, {p}",
        "{p}. anyway what's the homework",
        "listen {p} ok",
        "text me back, {p}",
    ],
    "pcm": [
        "{p}",
        "{p}",
        "abeg {p}",
        "guy {p} o",
        "{p} na",
        "e be like say {p}",
        "omo {p} sha",
        "no vex but {p}",
        "i swear {p} 😩",
        "{p}, no tell anybody",
        "my padi talk say {p}",
        "make i tell you, {p}",
        "{p} abi?",
        "as e dey now {p}",
        "see ehn {p}",
        "{p} 😭😭",
    ],
    "cs": [
        "{p}",
        "abeg no vex, {p}",
        "wallahi {p}",
        "omo {p} o jare",
        "nne {p} biko",
        "kai {p}",
        "{p} sha, wetin i go do",
        "haba {p}",
        "chai {p} 💔",
        "mehn {p} fr",
        "oya {p}",
        "{p} abeg 🙏",
        "walahi tallahi {p}",
        "ehen {p} nau",
        "biko {p}, i dey serious",
        "{p} sef 😭",
    ],
}

SEEDS = {
    "Self-Harm": {
        "high": [
            "i want to die",
            "i wanna die",
            "i want to kill myself",
            "kms",
            "i'm going to unalive myself",
            "i don't want to exist anymore",
            "i'm going to end it tonight",
            "gonna take all the pills",
            "i will hang myself",
            "i wan hang myself",
            "i go end am tonight",
            "i don ready to die",
            "i dey cut myself",
            "i cut my arm again last night",
            "planning to jump from the bridge",
            "nobody will miss me when i'm gone",
            "i wrote my goodbye note",
            "make i just end everything",
            "i no wan wake up tomorrow",
            "how many paracetamol can kill someone",
        ],
        "review": [
            "i feel so worthless",
            "there's no point in living",
            "everyone would be better without me",
            "i'm tired of living",
            "i just want the pain to stop",
            "i don't see a future for me",
            "i wish i was never born",
            "i dey tire for this life",
            "nothing dey make sense again, i just wan vanish",
            "i want to disappear forever",
            "i cry every night and no one knows",
            "i hate being alive",
            "i wan just sleep and no wake",
            "aye yi ti su mi",
            "ike agwula m",
        ],
        "low": [
            "i feel empty inside",
            "i'm so sad all the time",
            "i hate myself",
            "i dey feel like say i no useful",
            "nobody cares about me",
            "i'm not okay",
        ],
    },
    "Eating Disorders": {
        "high": [
            "i haven't eaten in 3 days",
            "i throw up after every meal",
            "thinspo",
            "i purge after dinner",
            "ana buddy",
            "my ana coach said 400 calories max",
            "i take laxatives to lose weight",
            "i dey vomit after i chop",
            "i no go chop till saturday",
            "i fast for 48 hours every week",
            "i chew and spit so i don't gain weight",
            "bonespo",
        ],
        "review": [
            "i'm fasting till i see my ribs",
            "i only ate an apple today",
            "i need to lose 10kg before school resumes",
            "i hate my body so much",
            "i skip breakfast and lunch every day",
            "i counted calories all day again",
            "i dey hide food make my mama no see",
            "i wan thin like those instagram girls",
            "everyone says i'm skinny but i feel huge",
            "i no chop anything today and i feel good",
            "fear food",
            "thigh gap goals",
        ],
        "low": [
            "i feel so fat today",
            "i need to lose weight",
            "i look so big in this pic",
            "i dey too fat",
            "my stomach is disgusting",
        ],
    },
    "Sexual Content": {
        "high": [
            "send me your nudes",
            "send nudes",
            "send me a pic without your clothes",
            "show me your boobs",
            "let's have sex",
            "i want to fuck you",
            "come to my house let me touch you",
            "send me your naked video",
            "i will leak your nudes if you don't send more",
            "make we fuck",
            "send me your pussy pic",
            "let me see you naked on video call",
            "take off your shirt on camera",
            "i go pay you if you send your body",
            "wetin dey under your skirt, snap am send",
            "porn link",
            "watch this porn video",
            "onlyfans link in bio",
            "sexting",
            "let me suck you",
            "fi aworan ihoho ranse si mi",
            "turo mini hoton tsiraici",
            "zitere m foto gi n'ihe",
        ],
        "review": [
            "come over when nobody is home",
            "let's do it after school",
            "are you a virgin",
            "what are you wearing right now",
            "i want to kiss you all over",
            "let's netflix and chill at mine",
            "make we do am for my house",
            "i wan touch you small",
            "you dey horny?",
            "send pics of you in the shower",
            "let's meet alone, don't bring anyone",
            "delete this chat after reading",
        ],
        "low": [
            "you look so hot in that pic",
            "you're so sexy",
            "send more pics of you",
            "you get body o",
            "fine girl send your pic",
        ],
    },
    "Violence": {
        "high": [
            "i will kill you",
            "i'm going to stab you",
            "i will bring a knife to school",
            "i'm gonna shoot up the class",
            "i'll break your legs",
            "i go stab you",
            "i go kill you and your family",
            "i get gun, try me",
            "we go waste am",
            "i will beat you till you bleed",
            "i'll bring my brother's gun tomorrow",
            "i go cut you with blade",
            "i will strangle you",
            "we go burn their house",
            "zan kashe ka yau",
            "maa pa e loni",
            "aga m egbu gi",
        ],
        "review": [
            "meet me after school, i'll beat you",
            "we are going to jump him tomorrow",
            "i will deal with you tomorrow",
            "wait till i catch you outside",
            "we go beat am after school",
            "i go show you pepper tomorrow",
            "bring your gang, we'll fight",
            "i will slap sense into you",
            "i'm going to punch his face in",
            "we dey plan to fight them after class",
            "i go break your head",
            "you go see wetin i go do you",
            "zan doke ka",
            "ma lu e daada",
        ],
        "low": [
            "i'll slap you",
            "i'll punch you",
            "i go slap you small",
            "don't make me hit you",
        ],
    },
    "Graphic Content": {
        "high": [
            "watch this beheading video",
            "video of a man being burned alive",
            "they cut off his head on camera",
            "gore video",
            "look at his brains on the floor",
            "graphic footage of the accident, bodies everywhere",
            "someone got shot in the head on this video",
            "video of the guy who got dismembered",
            "they hacked him with machete, see the video",
            "his intestines were hanging out",
            "see the burnt bodies from the tanker explosion",
            "watch them slaughter him",
            "liveleak type video",
            "video wey dem cut person head",
            "see as him body scatter for road",
        ],
        "review": [
            "blood everywhere in this video",
            "dead body pictures from the accident",
            "the corpse was still on the road",
            "so much blood in that clip",
            "they showed the dead bodies on the news",
            "dead body dey the video",
            "blood dey everywhere for the video",
            "see the crash photo, blood full ground",
            "i saw a dead person today, still shaking",
        ],
        "low": [
            "that video was disturbing",
            "this video is not for the weak",
            "trigger warning: gross video",
            "this clip too scary abeg",
        ],
    },
    "Substance Use": {
        "high": [
            "where can i buy weed",
            "i'm selling weed, dm me",
            "i fit buy weed give you",
            "who dey sell igbo for your area",
            "let's buy cocaine this weekend",
            "i snorted coke last night",
            "i take tramadol to feel high",
            "buy codeine syrup from the chemist",
            "we go buy loud after school",
            "bring the colos to the party",
            "who sabi where dem dey sell kush",
            "i get sk, who wan buy",
            "i dey sell tramol 225",
            "my plug get molly",
            "let's get some pills for the party",
            "i mixed codeine and sprite",
            "shrooms for saturday",
        ],
        "review": [
            "let's get high after school",
            "make we blaze this weekend",
            "i smoked with the boys yesterday",
            "i got so drunk last night",
            "roll a blunt for us",
            "let's vape in the toilet",
            "i took two shots before class",
            "we dey smoke for back of school",
            "who get lighter make we light am",
            "i wan get high tonight",
            "the loud hit different",
            "i dey drink codeine every night",
            "vape pen for sale",
            "make we drink gin and mix",
            "i don high die",
        ],
        "low": [
            "i want to try smoking",
            "have you ever been drunk",
            "shisha tonight?",
            "my brother came home drunk",
        ],
    },
    "Hate Speech": {
        "high": [
            "kill all of them",
            "go back to your country",
            "your people should be wiped out",
            "you don't deserve to live",
            "they should all be exterminated",
            "we should burn all of them",
            "una no belong here, commot",
            "all of you should die",
            "your tribe should be wiped off",
            "death to all of them",
            "kill every one of them",
        ],
        "review": [
            "your people are animals",
            "all of them are cockroaches",
            "your tribe is useless",
            "i hate your people",
            "you people are all thieves",
            "your kind are all criminals",
            "they are subhuman",
            "go back to your village, monkey",
            "your religion is for terrorists",
            "una people na all fraudsters",
            "people like you are a disease",
            "you smell like your people",
            "your kind are not human",
            "we don't want your kind here",
            "all of them are dirty",
            "you people are always stealing",
        ],
        "low": [
            "you people are always like this",
            "your people again",
            "una people sef",
        ],
    },
    "Gambling": {
        "high": [
            "i staked my school fees on bet9ja",
            "i put my allowance on the parlay",
            "i bet my savings on the match",
            "deposit 5k for the casino app",
            "i don stake my pocket money",
            "i borrowed money to bet",
            "i lost all my money on sportybet",
            "i used my mum's card to fund my betting account",
            "stake my lunch money on the game",
            "i wan stake my fees, the odds sweet",
            "i lost 20k on aviator today",
            "fund my sporty account abeg",
        ],
        "review": [
            "drop your booking code",
            "my parlay cashed out",
            "i'm on a 10 odds accumulator",
            "let's bet on the match tonight",
            "bet9ja booking code for today",
            "who get sure odds",
            "sporty don pay me",
            "i dey play aviator now",
            "join my betting group",
            "1xbet promo code",
            "i won 3k on baba ijebu",
            "make we stake small",
            "betking cashout",
            "load my betting wallet",
            "sure banker for today",
        ],
        "low": [
            "lottery ticket",
            "scratch card win",
            "i buy ticket for the draw",
            "raffle ticket",
        ],
    },
}

BENIGN = [
    "i wan chop rice",
    "i dey come",
    "we get maths test tomorrow",
    "send me the assignment",
    "who dey play ball later",
    "what time is the match",
    "my phone battery is dying",
    "did you finish the physics homework",
    "mummy said i should come home early",
    "the wifi is not working again",
    "i'm so tired of this heat",
    "nepa don take light",
    "we should study together this weekend",
    "have you seen the new spider man",
    "i got 78 in chemistry",
    "can you send the notes for biology",
    "i'm coming to your house at 4",
    "what's the date for the exam",
    "let's play fifa tonight",
    "the teacher gave us double homework",
    "i dey hungry die",
    "make we go buy suya",
    "she said hi to me today omg",
    "i finally finished the book",
    "my sister is annoying me",
    "school resumes on monday",
    "did you watch the arsenal game",
    "i need a new charger",
    "the bus was so late today",
    "i'm learning to code in python",
    "our team won the debate",
    "send me your location",
    "let me call you back",
    "i love this song so much",
    "did you do question 5",
    "bring my book tomorrow",
    "i'm at the bus stop",
    "my mum made jollof",
    "the exam was hard sha",
    "who get the timetable",
    "i wan sleep",
    "e don tey wey i see you",
    "we go see tomorrow",
    "wetin be the homework",
    "i no understand this topic",
    "make we read together",
    "abeg send me the link",
    "how far, you don eat",
    "the class was boring today",
    "i want to learn the guitar",
    "my dad is taking us to the beach",
    "what's your favourite anime",
    "can i borrow your calculator",
    "we won the inter house sports",
    "i miss my grandma",
    "happy birthday bro",
    "congrats on your result",
    "the movie was so funny",
    "i'm learning french on duolingo",
    "let's go to the library",
    "what's for lunch",
    "i can't find my id card",
    "did you see the new phone",
    "help me with this question",
    "i'm bored, let's talk",
    "goodnight, see you tomorrow",
    "my uncle is visiting",
    "i drew a picture of a cat",
    "our teacher is so nice",
    "i scored a goal today",
    "the market was crowded",
    "traffic was crazy today",
    "i'm watching youtube",
    "let's start a study group",
    "which school did you apply to",
    "i passed my driving test",
    "the food at the party was great",
    "my cousin is coming for christmas",
    "it's raining heavily here",
    "i forgot my umbrella",
    "the generator is too loud",
    "let me finish my chores first",
    "my mum said no",
    "i am praying for you",
    "church was long today",
    "jumat prayer at 1",
    "what's the wifi password",
    "the printer is not working",
    "i need to buy a new bag",
    "i got a new haircut",
    "which colour should i pick",
    "did you charge the power bank",
    "the game is tied 1-1",
    "sorry i was sleeping",
    "i am on my way",
    "can we meet at the canteen",
    "the assembly was long",
    "i'll ask my mum",
    "what's your ig handle",
    "follow me back",
    "send me the tiktok",
    "that dance was crazy",
    "i'm learning a new skill",
    "the road is bad",
    "my dog is sick",
    "we planted flowers in the garden",
    "the test was easy",
    "i lost my pen again",
    "i dey house",
    "you don do the assignment",
    "we dey go church tomorrow",
    "my mama dey call me",
    "make i sleep small",
    "i don reach house",
    "we get free period now",
    "abeg help me hold my bag",
    "who go bring ball tomorrow",
    "i dey watch film",
    "make we go eat",
    "e sweet die",
    "nne kedu",
    "bawo ni, se daadaa ni",
    "ina kwana, yaya gida",
    "kedu ka i mere",
    "e kaaro ma",
    "sannu da zuwa",
    "daalu nne",
    "ese gan",
    "na gode sosai",
    "i go come your house tomorrow",
    "the light don come back",
    "i don pay the school fees",
    "wetin dey happen for school",
    "my teacher praise me today",
    "the party was lit",
    "i finished the assignment",
    "pls remind me tomorrow",
    "i'll be there in 10 minutes",
    "we need to buy data",
    "my data don finish",
    "send me airtime abeg",
    "who has the group link",
    "i can't come today, i'm sick",
    "i have malaria",
    "the doctor gave me drugs for malaria",
    "i took paracetamol for headache",
    "the nurse gave me an injection",
    "we visited the museum",
    "our class went on excursion",
    "i want to be a doctor",
    "i want to join the army",
    "the police station is near my house",
    "my brother is a soldier",
    "we learned about the civil war in history",
    "the news said fuel price went up",
    "we watched a documentary on world war two",
    "the history teacher talked about slavery",
    "we discussed racism in civic education",
    "the pastor preached about love",
    "the imam talked about patience",
]

HARD_NEGATIVES = [
    "we made popcorn and watched a movie",
    "the match has begun already",
    "which method did you use for question 4",
    "my cousin lives in scunthorpe",
    "we killed it 4-0 today",
    "this teacher go kill me with homework 💀",
    "i dey do diet for my aunty wedding",
    "igbo language class was fun",
    "we saw a gun at the museum trip",
    "my phone died 💀",
    "i'm dead tired after practice",
    "shoot your shot bro",
    "that exam was murder lol",
    "kill the lights please",
    "this song is fire 🔥",
    "i got a high score in the game",
    "i need high grades this term",
    "coke and fanta for the party",
    "hook the printer up to the laptop",
    "the strike has begun",
    "the class is dead quiet",
    "this beat dey kill me 😂",
    "this movie go kill me with laugh",
    "i'm dying of laughter 😂😂",
    "you dey kill me with jokes lmao",
    "i want to die of embarrassment lol",
    "she speaks igbo and yoruba fluently",
    "igbo food is the best",
    "i am learning hausa",
    "we watched the documentary about drugs in school",
    "the doctor prescribed drugs for my cough",
    "say no to drugs campaign at school",
    "we did a project on gambling addiction",
    "the pastor preached against betting",
    "my dad said betting is bad",
    "my mum is on a diet",
    "my aunt lost weight after the surgery",
    "the football pitch is dead",
    "i shot the ball over the bar",
    "he scored a hat trick and killed the game",
    "we are dead if we fail this test lol",
    "sex education class was awkward",
    "the biology teacher explained reproduction",
    "the nurse talked about puberty",
    "she wore a hot pink dress",
    "it's so hot today",
    "the jollof was hot",
    "the sun is killing me",
    "my back is killing me from the chairs",
    "we are cooking with coconut",
    "the corpse in the movie looked fake",
    "history class was about the biafra war",
    "the news said a building collapsed",
    "the fight in the anime was epic",
    "the boxing match was on tv",
    "my brother beat me at chess",
    "we beat their school in football",
    "i beat my high score",
    "i will beat you in fifa tonight",
    "our team got slaughtered 5-0 lol",
    "meth is short for methodology in our project",
    "the chemistry teacher explained methane",
    "the assassin in the game is strong",
    "call of duty tonight?",
    "i killed the boss in the game",
    "the zombie game is so bloody",
    "the horror film had fake blood",
    "the racism topic in civic was deep",
    "we learned about the holocaust",
    "the pastor said all people are equal",
    "my dad drinks beer on sundays",
    "the party had wine for the adults",
    "there was a fire on the news",
    "my uncle smokes fish for a living",
    "smoke from the generator is annoying",
    "the light is high today",
    "the kite is flying high",
    "i'm high on sugar 😂",
    "we got high marks in the quiz",
    "the odds of rain are high",
    "the lottery of life sha",
    "raffle draw at the school fair",
    "the casino scene in the movie was cool",
    "he bet me i can't finish the jollof",
    "i bet you can't beat me at fifa",
    "you people won the debate",
    "your people are so kind",
    "our country is beautiful",
    "i want to travel to my country side",
    "nude colour nail polish for the party",
    "the baby was naked in the bath",
    "the art class drew a nude statue",
    "hot chocolate for breakfast",
    "the teacher was so strict she killed the vibe",
    "my laptop is dead",
    "the deadline is tomorrow",
    "dead end on this road",
    "i'm gonna kill this presentation",
    "i'm going to slay this exam",
    "cutting the cake now 🎂",
    "i cut my hair",
    "i cut my finger while cooking",
    "cut the video at 2 minutes",
    "i want to lose weight for the sports competition",
    "the coach said eat more protein",
    "the fasting month starts next week",
    "we are fasting for lent",
    "i skipped breakfast because i woke up late",
    "not eating out today, no money",
    "the pig is fat",
    "the cat is too fat lol",
    "the dog is starving, let's feed it",
    "the movie had a bar fight",
    "punch the ticket at the gate",
    "the punch at the party was sweet",
    "slap the mosquito",
    "this heat will end me 😂",
    "this assignment will be the end of me",
    "end of term party",
    "i want to disappear from this group chat lol",
    "i'm so done with this homework",
    "the wifi is hopeless",
    "our team is hopeless at football lol",
    "i'm depressed that arsenal lost",
    "the scratch on my phone screen",
    "scratch that, let's meet at 5",
    "the odds and evens game",
    "the gore in the movie was cgi",
    "the mummy in the museum was a real corpse",
    "the bloodbank needs donors",
    "i donated blood today",
    "the blood test came out fine",
    "that goal was sick",
    "the concert was sick",
    "i'm sick with malaria",
    "the weed in our garden is growing",
    "my mum said i should weed the garden",
    "the cocaine seizure was on the news",
    "the police caught drug dealers on the news",
    "the school shot a video for the anniversary",
    "she shot the winning basket",
    "i'll shoot you the link",
]

DRUG_TEMPLATES = [
    "where i fit buy {p}",
    "who get {p} for sale",
    "make we smoke {p} after school",
    "i wan buy {p} tonight",
    "my plug get {p}, who wan join",
    "let's get some {p} for the party",
    "i took {p} yesterday and i was so high",
    "bring the {p} come",
]

BUYABLES = [
    "data", "airtime", "bread", "suya", "biscuit", "indomie", "recharge card", "uniform", "textbook", "sneakers",
    "charger", "earpiece", "ticket", "popcorn", "zobo", "puff puff", "chin chin", "malt", "fanta", "gala",
    "meat pie", "sachet water", "pure water", "plantain chips", "ice cream", "shawarma", "pizza", "jollof",
    "phone case", "power bank", "school bag", "sim card", "cardigan", "socks", "football", "ps5 pad", "drinks",
    "chicken", "egg roll", "doughnut", "yoghurt", "capri sun", "lacasera", "coke", "sprite", "cake", "sweets",
    "chewing gum", "biro", "exercise book",
]

DRUG_BLOCKLIST = {
    "igbo", "high", "turn up", "ice", "crystal", "loud", "stuff", "green", "grass", "cream", "number", "solution",
    "petrol", "brown", "sugar", "sugars", "boom", "rub", "tea", "candy", "coke", "pot", "snow", "rock", "speed",
    "lean", "blow", "dope", "gas", "fire", "pills", "juice", "water", "fish", "eja", "akpu", "nkwu", "gbedu", "wee",
    "sk", "trama", "sweet", "kush", "cake", "biscuit", "roll", "wrap", "cola", "chalk", "flakes", "egg", "salt",
}


def lexicon_phrases():
    d = json.loads(LEXICON.read_text())
    out = []
    for cat, langs in d["categories"].items():
        for lang, sev in langs.items():
            for s, phr in sev.items():
                for p in phr:
                    out.append((p, lang, cat, s))
    return out


L33T = {"o": "0", "e": "3", "a": "4", "i": "1", "s": "5"}


def l33t(p: str) -> str:
    return "".join(L33T.get(c, c) if rng.random() < 0.6 else c for c in p)


def template_langs(lang: str) -> list[str]:
    if lang == "en":
        return ["en", "pcm", "cs"]
    if lang == "pcm":
        return ["pcm", "cs", "en"]
    return ["cs", "pcm"]


def expand(phrase: str, lang: str, per_lang: tuple[int, int] = (6, 10)) -> list[tuple[str, str]]:
    out = []
    for tl in template_langs(lang):
        k = rng.randint(*per_lang)
        for t in rng.sample(TEMPLATES[tl], min(k, len(TEMPLATES[tl]))):
            out.append((t.format(p=phrase), tl if tl != "cs" else "cs"))
    return out


def main():
    stats = Counter()
    rows: list[dict] = []
    seen: set[str] = set()

    def add(text, category, severity, lang, source, kind):
        text = clean(text)
        if len(text) < 3:
            return
        key = text.lower()
        if key in seen:
            return
        seen.add(key)
        rows.append({"text": text, "category": category, "severity": severity, "lang": lang, "source": source, "kind": kind})
        stats[(source, category or "SAFE")] += 1

    print("templated lexicon + seeds", file=sys.stderr)
    phrases = lexicon_phrases()
    for cat, sevs in SEEDS.items():
        for sev, ps in sevs.items():
            for p in ps:
                phrases.append((p, "en", cat, sev))
    for p, lang, cat, sev in phrases:
        for text, tl in expand(p, lang):
            add(text, cat, sev, tl, "template", "positive")
        if lang == "en" and rng.random() < 0.35:
            for text, tl in expand(l33t(p), lang, (1, 2)):
                add(text, cat, sev, tl, "template_l33t", "positive")

    for p in BENIGN:
        for text, tl in expand(p, "pcm" if any(w in p.split() for w in ("dey", "wan", "abeg", "wetin", "don", "na")) else "en", (4, 7)):
            add(text, None, None, tl, "template", "safe")
    for p in HARD_NEGATIVES:
        for text, tl in expand(p, "en", (2, 4)):
            add(text, None, None, tl, "template", "hard_negative")

    print("Ram07/Detection-for-Suicide", file=sys.stderr)
    sui = cached(
        "suicide",
        lambda: flatten(fetch_by_label("Ram07/Detection-for-Suicide", "default", "train", "class", {"suicide": 1500, "non-suicide": 3000}, 174436), "text"),
    )
    non = [r for r in sui if r["label"] == "non-suicide"]
    for r in [r for r in sui if r["label"] == "suicide"]:
        add(r["text"], "Self-Harm", "high", "en", "hf:suicide", "positive")
    for r in non[:1500]:
        add(r["text"], None, None, "en", "hf:suicide", "safe")
    benign_en = [clean(r["text"]) for r in non[1500:3000]]

    print("poorvanshi04/cyberbullying_tweets.csv", file=sys.stderr)
    cb = cached(
        "cyberbullying",
        lambda: flatten(
            fetch_by_label(
                "poorvanshi04/cyberbullying_tweets.csv",
                "default",
                "train",
                "cyberbullying_type",
                {"ethnicity": 500, "religion": 500, "gender": 500, "not_cyberbullying": 3000},
                47692,
            ),
            "tweet_text",
        ),
    )
    cb_not = [r for r in cb if r["label"] == "not_cyberbullying"]
    for r in cb:
        if r["label"] in ("ethnicity", "religion", "gender"):
            add(r["text"], "Hate Speech", "review", "en", "hf:cyberbullying", "positive")
    for r in cb_not[:1500]:
        add(r["text"], None, None, "en", "hf:cyberbullying", "safe")
    benign_en += [clean(r["text"]) for r in cb_not[1500:3000]]

    print("Maxx0/sexting-nsfw-adultconten", file=sys.stderr)
    sx = cached("sexting", lambda: fetch_rows("Maxx0/sexting-nsfw-adultconten", "default", "train", 275))
    sx_lines = [r[c] for r in sx for c in ("He", "She") if r.get(c)]
    rng.shuffle(sx_lines)
    for t in sx_lines[:400]:
        add(t, "Sexual Content", "high", "en", "hf:sexting", "positive")

    print("franciellevargas/HausaHate", file=sys.stderr)
    hh = cached("hausahate", lambda: fetch_rows("franciellevargas/HausaHate", "default", "train", 2000))
    hate = [r for r in hh if r.get("label_hate") in (1, 2)]
    safe_h = [r for r in hh if r.get("label_hate") not in (1, 2) and not r.get("label_offensive")]
    rng.shuffle(safe_h)
    for r in hate:
        add(r["text"], "Hate Speech", "review", "ha", "hf:hausahate", "positive")
    for r in safe_h[: max(0, 800 - len(hate))]:
        add(r["text"], None, None, "ha", "hf:hausahate", "safe")

    print("HausaNLP/NaijaSenti-Twitter", file=sys.stderr)
    benign_ng: list[str] = []
    for cfg in ("pcm", "hau", "yor", "ibo"):
        tr = cached(f"naijasenti_{cfg}_train", lambda: fetch_rows("HausaNLP/NaijaSenti-Twitter", cfg, "train", 600))
        te = cached(f"naijasenti_{cfg}_test", lambda: fetch_rows("HausaNLP/NaijaSenti-Twitter", cfg, "test", 750))
        for r in tr:
            add(r["tweet"], None, None, cfg, "hf:naijasenti", "safe")
        benign_ng += [clean(r["tweet"]) for r in te]

    print("adi515/drug_slangs", file=sys.stderr)
    ds = cached("drug_slangs", lambda: fetch_rows("adi515/drug_slangs", "default", "train", 1277))
    terms = sorted(
        {
            r["term"].strip().lower()
            for r in ds
            if (r.get("nationality") == "Nigerian" or r.get("language") in ("en", "en-pidgin", "yo", "ig", "ha"))
            and float(r.get("confidence") or 0) >= 0.9
            and len(r["term"].strip()) >= 3
            and r["term"].strip().lower() not in DRUG_BLOCKLIST
        }
    )
    rng.shuffle(terms)
    terms = terms[:160]
    for term in terms:
        for t in rng.sample(DRUG_TEMPLATES, 2):
            add(t.format(p=term), "Substance Use", "review", "pcm", "template_drug", "positive")
    for item in BUYABLES:
        for t in rng.sample(DRUG_TEMPLATES, 3):
            add(t.format(p=item), None, None, "pcm", "template_drug", "hard_negative")

    pos = [r for r in rows if r["category"]]
    safe = [r for r in rows if not r["category"]]
    cap = int(len(pos) * 0.4 / 0.6)
    if len(safe) > cap:
        rng.shuffle(safe)
        safe = safe[:cap]
    rows = pos + safe
    rng.shuffle(rows)

    (HERE / "train.jsonl").write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    check = [{"text": t, "lang": "ng"} for t in benign_ng if len(t) >= 3] + [{"text": t, "lang": "en"} for t in benign_en if len(t) >= 3]
    (HERE / "benign_check.jsonl").write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in check) + "\n")

    by_cat = Counter(r["category"] or "SAFE" for r in rows)
    by_src = Counter((r["source"], r["category"] or "SAFE") for r in rows)
    summary = {
        "total": len(rows),
        "byCategory": dict(by_cat),
        "bySource": {f"{s} / {c}": n for (s, c), n in sorted(by_src.items())},
        "bySeverity": dict(Counter(r["severity"] for r in pos)),
        "drugTerms": len(terms),
        "benignCheck": {"ng": len(benign_ng), "en": len(benign_en)},
    }
    (HERE / "stats.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
