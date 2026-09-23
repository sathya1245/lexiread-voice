/**
 * Offline word knowledge.
 *
 * LexiRead prefers the free dictionary API when it is reachable, but a demo
 * classroom may be offline (or the word may be a school term the API explains
 * badly). Everything here is deliberately small, inspectable and
 * language-pluggable — a future iteration ships the same three fields
 * (`kid`, `mid`, `grown`) per word for other languages.
 */

/** word -> [part of speech, kid explanation, mid explanation, grown explanation] */
export const LOCAL_DEFINITIONS = {
  photosynthesis: ['noun', 'the way plants make their own food using sunlight', 'how green plants turn sunlight, water and air into food', 'the process by which green plants convert light energy into chemical energy stored as glucose'],
  chlorophyll: ['noun', 'the green stuff in leaves that catches sunlight', 'the green colour in leaves that traps light for the plant', 'the green pigment in chloroplasts that absorbs light for photosynthesis'],
  cell: ['noun', 'the smallest living part of a plant or animal', 'the tiny building block that all living things are made of', 'the smallest structural and functional unit of a living organism'],
  energy: ['noun', 'the power to do work or make things move', 'what makes things move, grow or get hot', 'the capacity of a system to do work, measured in joules'],
  gravity: ['noun', 'the pull that makes things fall down', 'the invisible pull that holds us on the ground', 'the force of attraction between any two masses'],
  ecosystem: ['noun', 'all the living things in a place and their home', 'a community of plants, animals and their surroundings', 'a biological community interacting with its non-living environment as a system'],
  molecule: ['noun', 'a tiny group of atoms joined together', 'the smallest piece of a substance made of atoms joined up', 'the smallest particle of a substance that keeps its chemical properties'],
  atom: ['noun', 'the tiniest piece of matter', 'a tiny building block that makes up everything', 'the smallest unit of ordinary matter with the properties of a chemical element'],
  democracy: ['noun', 'when people choose their leaders by voting', 'a country where people vote to decide who leads', 'a system of government in which power is held by the people through elected representatives'],
  government: ['noun', 'the group of people who make the rules for a country', 'the people who run a country and make its laws', 'the body that exercises authority and administers the state'],
  revolution: ['noun', 'a big change, or when people take over a government', 'a huge change, or when a country gets a new leader by force', 'a fundamental change in political power or social structure'],
  photosynthesis_rate: ['noun', 'how fast a plant makes food', 'the speed at which a plant makes its food', 'the rate of light-dependent carbon fixation'],
  fraction: ['noun', 'a part of a whole', 'a piece of something whole, like a half or a quarter', 'a numerical quantity that is not a whole number, expressed as a ratio'],
  decimal: ['noun', 'a number with a dot that shows parts', 'numbers with a point that show part of a whole', 'a number expressed in the base-10 positional system with a fractional part'],
  equation: ['noun', 'a maths sentence with an equals sign', 'a maths statement that two things are equal', 'a statement asserting the equality of two mathematical expressions'],
  variable: ['noun', 'a letter that stands for a number', 'a letter that holds the place of an unknown number', 'a symbol representing a quantity that may change within a problem'],
  angle: ['noun', 'the space where two lines meet', 'the corner shape made when two lines meet', 'the figure formed by two rays meeting at a common endpoint, measured in degrees'],
  triangle: ['noun', 'a shape with three straight sides', 'a flat shape with three sides and three corners', 'a three-sided polygon whose interior angles sum to 180 degrees'],
  symmetry: ['noun', 'when one half is a mirror of the other', 'when two halves of something match like a mirror', 'invariance of a shape or system under a transformation'],
  ecosystem_balance: ['noun', 'when all living things in a place get along', 'when plants and animals in a place stay in balance', 'the dynamic equilibrium maintained by feedback loops within a community'],
  climate: ['noun', 'the usual weather of a place', 'the normal weather of a place over many years', 'the long-term statistical pattern of atmospheric conditions in a region'],
  atmosphere: ['noun', 'the air all around the earth', 'the blanket of air around a planet', 'the layer of gases held around a planet by gravity'],
  pollution: ['noun', 'dirt that harms air, water or land', 'harmful dirt in the air, water or ground', 'the introduction of contaminants into the natural environment causing adverse change'],
  nutrient: ['noun', 'good stuff in food that helps you grow', 'something in food that living things need to grow', 'a substance that provides nourishment essential for growth and metabolism'],
  digestion: ['noun', 'how your body breaks food down', 'how the body breaks food into pieces it can use', 'the mechanical and chemical breakdown of food into absorbable nutrients'],
  nervous_system: ['noun', 'the body system that sends messages', 'the nerves and brain that carry messages in the body', 'the network of neurons and supporting cells that coordinates body activity'],
  vaccine: ['noun', 'a shot that stops you getting a sickness', 'medicine that teaches your body to fight a disease', 'a biological preparation that provides acquired immunity to a pathogen'],
  antibiotic: ['noun', 'medicine that kills germs', 'medicine that kills bacteria making you sick', 'an antimicrobial agent that kills or inhibits bacterial growth'],
  empire: ['noun', 'many countries ruled by one power', 'a group of lands ruled by one country or ruler', 'a political unit comprising several territories under a single sovereign authority'],
  colony: ['noun', 'a place ruled by another faraway country', 'a land settled or controlled by another country', 'a territory under the political control of a distant state'],
  independence: ['noun', 'when a country rules itself', 'being free to make your own choices', 'the state of self-governance and freedom from external control'],
  constitution: ['noun', 'the main rule book of a country', 'the rules that say how a country is run', 'the fundamental principles by which a state is governed'],
  economy: ['noun', 'how a country makes and spends money', 'the way a place makes, buys and sells things', 'the system of production, distribution and consumption of goods and services'],
  photosynthesis_equation: ['noun', 'the recipe plants use to make food', 'the word recipe for how plants make food', 'the balanced chemical equation 6CO2 + 6H2O + light -> C6H12O6 + 6O2'],
  metaphor: ['noun', 'saying one thing is another to help you picture it', 'describing something by calling it something else', 'a figure of speech asserting an implied comparison between two unlike things'],
  simile: ['noun', 'comparing two things using like or as', 'a comparison using the words like or as', 'a figure of speech comparing two things using like, as, than or resembles'],
  theme: ['noun', 'the main idea of a story', 'the big idea a story is really about', 'the central recurring idea or message explored by a text'],
  protagonist: ['noun', 'the main person in a story', 'the main character the story follows', 'the leading character whose fortunes drive the narrative'],
  paragraph: ['noun', 'a group of sentences about one idea', 'a block of sentences that belong together', 'a distinct section of a text developing a single controlling idea'],
  vocabulary: ['noun', 'all the words you know', 'the words a person knows and uses', 'the set of words known or used by a person or in a language'],
  syllable: ['noun', 'a beat in a word', 'a word part you say in one puff of air', 'a unit of pronunciation containing a vowel sound, with or without consonants'],
  consonant: ['noun', 'a letter that is not a vowel', 'a sound like b, c, d, f that is not a vowel', 'a speech sound produced with a partial or complete closure of the vocal tract'],
  vowel: ['noun', 'the letters a, e, i, o, u', 'a, e, i, o, u — the open sounds in words', 'a speech sound produced without significant constriction of the vocal tract'],
  hypothesis: ['noun', 'a smart guess you can test', 'an idea you test with an experiment', 'a testable, falsifiable proposed explanation for a phenomenon'],
  experiment: ['noun', 'a test to find out what is true', 'a careful test to see what happens', 'a controlled procedure undertaken to test a hypothesis'],
  observation: ['noun', 'something you notice with your senses', 'what you notice by looking and listening', 'the systematic recording of phenomena using the senses or instruments'],
  conclusion: ['noun', 'what you decide at the end', 'the answer you reach at the end', 'a judgement or decision reached by reasoning from evidence'],
  evidence: ['noun', 'facts that show what is true', 'proof from facts that shows something', 'information indicating whether a proposition is true'],
  summarize: ['noun', 'to say the main points in a few words', 'to tell the big ideas briefly', 'to state the central points of a text concisely'],
  compare: ['verb', 'to see how things are the same or different', 'to look at what is alike and what is different', 'to examine similarities and differences between items'],
  sequence: ['noun', 'things in the order they happen', 'the order something happens in', 'an ordered arrangement of related events or steps'],
  cause: ['noun', 'why something happens', 'the reason something happens', 'the agent or reason that produces an effect'],
  effect: ['noun', 'what happens because of something', 'the result of something happening', 'a change produced by an action or cause'],
  ecosystem_word: ['noun', 'a place where living things and nature work together', 'living things plus their surroundings working together', 'a functional unit of organisms interacting with their abiotic environment'],

  /* --- further everyday school vocabulary (used when the dictionary is offline) --- */
  glucose: ['noun', 'a sugar that plants make and use for energy', 'a simple sugar that living things use for energy', 'a monosaccharide produced by photosynthesis and used as cellular fuel'],
  oxygen: ['noun', 'the gas in air that animals need to breathe', 'the gas animals breathe in to stay alive', 'the diatomic gas O2 required for aerobic respiration'],
  carbon_dioxide: ['noun', 'the gas plants take in from the air', 'a gas in the air that plants use to make food', 'the gas CO2 fixed into sugars during photosynthesis'],
  pigment: ['noun', 'the colour in something', 'the natural colour inside leaves, skin or paint', 'a substance that absorbs specific wavelengths of light, producing colour'],
  stomata: ['noun', 'tiny holes in a leaf', 'the tiny openings on a leaf that let air in and out', 'microscopic pores in the leaf epidermis that regulate gas exchange'],
  absorb: ['verb', 'to soak something up', 'to take something in, like a sponge takes in water', 'to take up a substance or energy through a surface or medium'],
  sunlight: ['noun', 'the light from the sun', 'the light and warmth that comes from the sun', 'solar radiation, the primary energy source for photosynthesis'],
  vapour: ['noun', 'water in the air', 'water that has turned into a gas', 'water in its gaseous state, formed by evaporation or boiling'],
  evaporate: ['verb', 'to turn from water into air', 'when water dries up and goes into the air as gas', 'to change from a liquid to a gas below its boiling point'],
  condensation: ['noun', 'when air turns back into water drops', 'when water vapour cools and becomes drops again', 'the phase change of a vapour into a liquid on cooling'],
  precipitation: ['noun', 'rain or snow falling from clouds', 'water falling from clouds as rain, snow or hail', 'any product of atmospheric water vapour that falls to the ground'],
  transpiration: ['noun', 'water leaving a plant through its leaves', 'how plants breathe out water vapour', 'the loss of water vapour from plant leaves through stomata'],
  groundwater: ['noun', 'water that is under the ground', 'water stored in soil and rock under the surface', 'subsurface water held in the pore spaces of soil and bedrock'],
  respiration: ['noun', 'how living things use air to get energy', 'how bodies turn food and air into energy', 'the metabolic release of energy from glucose, using oxygen'],
  organism: ['noun', 'any living thing', 'a living thing, big or small', 'an individual living system capable of growth and reproduction'],
  habitat: ['noun', 'the home of a plant or animal', 'the place where an animal or plant lives', 'the natural environment in which a species lives'],
  predator: ['noun', 'an animal that hunts other animals', 'an animal that catches and eats other animals', 'an organism that kills and consumes other organisms'],
  species: ['noun', 'a group of animals or plants of the same kind', 'a type of living thing that can have young together', 'a group of organisms capable of interbreeding and producing fertile offspring'],
  friction: ['noun', 'the rub that slows things down', 'the force that slows things when they rub together', 'the force opposing relative motion between surfaces in contact'],
  circuit: ['noun', 'the path electricity travels around', 'a loop of wire that electricity can flow around', 'a closed path through which electric current flows'],
  electricity: ['noun', 'the power that runs lights and machines', 'energy that flows through wires', 'the flow of electric charge, measured in amperes and volts'],
  magnet: ['noun', 'a metal that pulls other metal', 'something that pulls iron and steel towards it', 'a material producing a magnetic field that attracts ferromagnetic metals'],
  orbit: ['noun', 'the path something takes around a planet or star', 'the circle a moon or planet travels around', 'the gravitationally bound path of one body around another'],
  erosion: ['noun', 'when wind or water wears rock away', 'when wind or water slowly breaks rock down', 'the geological process of transporting weathered material'],
  continent: ['noun', 'one of the big land areas of the world', 'a huge area of land like Africa or Asia', 'one of the major continuous landmasses on Earth'],
  equator: ['noun', 'the imaginary line around the middle of the Earth', 'the line round the middle of the world where it is hottest', 'the zero-latitude great circle equidistant from both poles'],
  climate_change: ['noun', 'the world getting warmer', 'long-term changes in the weather of the whole planet', 'long-term shifts in global temperature and weather patterns'],
  agriculture: ['noun', 'farming', 'growing crops and keeping animals for food', 'the practice of cultivating soil, crops and livestock'],
  irrigation: ['noun', 'bringing water to crops', 'water carried to fields to help plants grow', 'the artificial application of water to soil to support crop growth'],
  civilization: ['noun', 'a big society with cities and rules', 'an organised society with towns, laws and writing', 'an advanced, organised society with complex institutions'],
  treaty: ['noun', 'a written peace deal between countries', 'an agreement between countries', 'a formally concluded and ratified agreement between states'],
  citizen: ['noun', 'a person who belongs to a country', 'someone who legally belongs to a country', 'a legally recognised member of a state with rights and duties'],
  parliament: ['noun', 'the group of people who make a country’s laws', 'the place where leaders meet to make laws', 'the legislative body of a state, typically elected'],
  migration: ['noun', 'when people or animals move to a new place', 'moving from one place to live in another', 'the movement of people or animals between regions or habitats'],
  artisan: ['noun', 'a craftsperson who makes things by hand', 'a skilled maker who works with their hands', 'a skilled craft worker producing goods by hand'],
  question_mark: ['noun', 'the ? sign', 'the punctuation mark that shows a question', 'the interrogative punctuation mark ?'],
  chemical: ['noun', 'a substance that things are made of', 'a substance studied in chemistry', 'a substance with a defined composition produced by or used in chemical reactions'],
  reaction: ['noun', 'what happens when things mix', 'what happens when two substances act on each other', 'a process in which substances are transformed into new substances'],
  ingredient: ['noun', 'one of the things you put in to make something', 'one part of a mixture or recipe', 'a component of a mixture, compound or process'],
  synthesis: ['noun', 'putting parts together to make something new', 'making something by joining parts together', 'the combination of components into a connected whole'],
  process: ['noun', 'a set of steps that makes something happen', 'the steps something goes through to happen', 'a series of actions taken to achieve a particular result'],
  release: ['verb', 'to let something go out', 'to let something out into the air or space', 'to set free or allow a substance to escape'],
  surface: ['noun', 'the outside or top of something', 'the outside layer of an object', 'the outermost boundary layer of a material'],
  growth: ['noun', 'getting bigger', 'the way living things get bigger', 'an increase in size, mass or number over time'],
  mixture: ['noun', 'two or more things mixed together', 'different things stirred together', 'a physical combination of substances that keep their own properties'],
  temperature: ['noun', 'how hot or cold something is', 'how warm or cold it is', 'the measure of average kinetic energy of particles, in degrees'],
  region: ['noun', 'an area of land', 'a part of a country or the world', 'a defined area distinguished by particular characteristics'],
};

/** Words whose difficulty is high but which have short everyday equivalents. */
export const SIMPLE_SWAP = {
  utilize: 'use', utilise: 'use', demonstrate: 'show', approximately: 'about', sufficient: 'enough',
  additionally: 'also', furthermore: 'also', consequently: 'so', therefore: 'so', however: 'but',
  nevertheless: 'still', purchase: 'buy', obtain: 'get', require: 'need', commence: 'start',
  terminate: 'end', assist: 'help', attempt: 'try', comprehend: 'understand', construct: 'build',
  facilitate: 'help', initiate: 'start', indicate: 'show', subsequently: 'then', previously: 'before',
  numerous: 'many', substantial: 'large', particular: 'certain', fundamental: 'basic',
  advantageous: 'helpful', detrimental: 'harmful', magnitude: 'size', velocity: 'speed',
  transform: 'change', convert: 'change', generate: 'make', produce: 'make', consume: 'use up',
  distribute: 'spread', accumulate: 'build up', perceive: 'notice', determine: 'find out',
  investigate: 'study', evaluate: 'judge', estimate: 'guess', calculate: 'work out',
  significant: 'important', essential: 'very important', various: 'different', primary: 'main',
  additional: 'extra', extreme: 'very great', rapid: 'fast', frequent: 'happening often',
  utilise_: 'use', optimum: 'best', maximum: 'most', minimum: 'least', response: 'answer',
  regarding: 'about', concerning: 'about', prior: 'earlier', duration: 'time', vicinity: 'nearby',
  reside: 'live', perform: 'do', utilize_energy: 'use energy', exhibit: 'show', comprise: 'include',
  possess: 'have', retain: 'keep', eliminate: 'remove', modify: 'change', expand: 'grow',
  diminish: 'shrink', encounter: 'meet', anticipate: 'expect', illustrate: 'show clearly',
  emphasize: 'stress', clarify: 'explain', define: 'explain the meaning of', identify: 'name',
  categorize: 'sort', organise: 'sort', organize: 'sort', analyze: 'study closely',
  analyse: 'study closely', synthesize: 'combine', component: 'part', aspect: 'side',
  beneficial: 'good for you', appropriate: 'right', alternative: 'other choice',
  mechanism: 'way it works', phenomenon: 'thing that happens', factor: 'reason',
  hypothesis_test: 'test idea', subsequent: 'next', initial: 'first', final: 'last',
  adjacent: 'next to', derived: 'comes from', composed: 'made of', represents: 'stands for',
};

/** Very common English words: anything outside this list can be a glossary term. */
export const COMMON_WORDS = new Set(
  `the of and to in is was it that he she they we you i on at by for with from as are be been being
   this these those their there here his her its our your my me him them us not no yes do does did done
   have has had having will would can could should may might must shall about above after again against
   all am an any because before below between both but down during each few more most other some such
   than then through too under until up very what when where which while who whom why how if or so
   one two three four five six seven eight nine ten first second next last new old good bad big small
   make made made take took taken give gave given go went gone come came get got put see saw seen say
   said tell told think thought know knew known want wanted use used find found look looked feel felt
   seem seemed leave left call called ask asked need needed try tried work worked part place where live
   lived day days time times year years week weeks month months hour hours minute minutes people person
   man men woman women child children thing things world life hand hands eye eyes water food air fire
   land home house school student students teacher book books word words page pages line lines story
   write wrote written read reading speak spoke spoken listen heard hear sound voice name names number
   numbers letter letters question answer problem example idea ideas help helped show showed start
   started end ended keep kept let lets run ran walk walked play played open opened close closed move
   moved stop stopped turn turned grow grew plant plants animal animals nature light lights dark dark
   hot cold warm cool long short high low near far left right same different small large great little
   much many only also just even still yet ever never always often sometimes together alone away back
   again over once around here now today tomorrow yesterday morning night evening sun moon star stars
   sky ground tree trees leaf leaves flower grass river sea ocean rain snow wind cloud warm body head
   face arm leg foot feet finger heart mind brain health sick well strong weak happy sad angry tired
   busy free easy hard fast slow early late young age grow plants oxygen carbon dioxide molecule cells
   science scientist study studies learn learning lesson lessons class classroom exam test tests mark
   marks grade grades write writing math maths english history geography art music sport game games
   family mother father parent parents brother sister friend friends home homes town city country
   countries government law rules rule money cost price buy sell shop market travel trip road street
   car bus train plane boat fly flew flown drive drove ride walk walked eat ate eaten drink drank
   sleep slept wake woke wear wore worn buy bought bring brought send sent begin began begun become
   became understand understood remember forgot forget choose chose chosen decide decided believe
   believed hope hoped wish wished need ask answer reply talk talked chat share shared care cared
   protect protected change changed grow grown increase decrease reduce effect affects cause result
   results data graph chart table figure diagram map list notes note idea summary main point points
   key important detail details fact facts opinion reason reasons why how what when where who`.split(
    /\s+/
  ).filter(Boolean)
);

/** Simple, non-technical spelling fixes — common school-age misspellings. */
export const SPELLING_MAP = {
  teh: 'the', adn: 'and', recieve: 'receive', recieved: 'received', becuase: 'because',
  becasue: 'because', becuse: 'because', definately: 'definitely', definatly: 'definitely',
  seperate: 'separate', seperated: 'separated', wich: 'which', wiht: 'with', hte: 'the',
  thier: 'their', freind: 'friend', freinds: 'friends', beacuse: 'because', alot: 'a lot',
  allways: 'always', untill: 'until', wierd: 'weird', beleive: 'believe', beleived: 'believed',
  ocassion: 'occasion', occassion: 'occasion', tommorow: 'tomorrow', tomorow: 'tomorrow',
  goverment: 'government', enviroment: 'environment', environmant: 'environment',
  knowlege: 'knowledge', nkowledge: 'knowledge', libary: 'library', libary: 'library',
  Febuary: 'February', Wensday: 'Wednesday', Feburary: 'February', buisness: 'business',
  bussiness: 'business', embarass: 'embarrass', embarassed: 'embarrassed', occured: 'occurred',
  occuring: 'occurring', begining: 'beginning', begining_: 'beginning', comming: 'coming',
  runing: 'running', stoped: 'stopped', droped: 'dropped', planed: 'planned', hopefull: 'hopeful',
  succesful: 'successful', successfull: 'successful', usefull: 'useful', carefull: 'careful',
  beautifull: 'beautiful', wonderfull: 'wonderful', gratefull: 'grateful',
  diffrent: 'different', diffrence: 'difference', differant: 'different',
  intresting: 'interesting', interresting: 'interesting', probaly: 'probably', probally: 'probably',
  probablly: 'probably', realy: 'really', realy_: 'really', finaly: 'finally', usualy: 'usually',
  usualy__: 'usually', especialy: 'especially', especiallly: 'especially', actuallly: 'actually',
  actualy: 'actually', basicaly: 'basically', definetly: 'definitely', certianly: 'certainly',
  evry: 'every', evrey: 'every', beutiful: 'beautiful', becaus: 'because', anser: 'answer',
  anwser: 'answer', quetion: 'question', questin: 'question', prolem: 'problem', probelm: 'problem',
  problen: 'problem', importent: 'important', importnat: 'important', importand: 'important',
  diferent: 'different', similiar: 'similar', similair: 'similar', compaer: 'compare',
  familar: 'familiar', familliar: 'familiar', nesseccary: 'necessary', necesary: 'necessary',
  neccessary: 'necessary', beleve: 'believe', acheive: 'achieve', acheived: 'achieved',
  experiance: 'experience', experence: 'experience', explaination: 'explanation',
  explination: 'explanation', grammer: 'grammar', writting: 'writing', raeding: 'reading',
  speling: 'spelling', litrature: 'literature', litreature: 'literature', scence: 'science',
  sciance: 'science', siance: 'science', photosythesis: 'photosynthesis',
  fotosynthesis: 'photosynthesis', photosinthesis: 'photosynthesis',
  clorophyll: 'chlorophyll', chloroplast_: 'chloroplast', oxigen: 'oxygen', oxygon: 'oxygen',
  carbondioxide: 'carbon dioxide', molecuel: 'molecule', molecuel_: 'molecule',
  atomes: 'atoms', gravety: 'gravity', gravty: 'gravity', ecosytem: 'ecosystem',
  ecosistem: 'ecosystem', democrasy: 'democracy', demacracy: 'democracy',
  govermant: 'government', revoultion: 'revolution', coloney: 'colony',
  independance: 'independence', constitusion: 'constitution', econemy: 'economy',
  wether: 'whether', witch: 'which', wich_: 'which', thoes: 'those', ther: 'there',
  whos: 'whose', to_: 'too', toose: 'those', verry: 'very', wery: 'very', someat: 'something',
  somthing: 'something', somethink: 'something', anythink: 'anything', nothink: 'nothing',
  evrything: 'everything', evreything: 'everything', peopel: 'people', peole: 'people',
  pepole: 'people', childs: 'children', childern: 'children', womens: 'women', mens: 'men',
  famlies: 'families', familys: 'families', countys: 'countries', citys: 'cities',
};

/** Homophone pairs worth a gentle nudge, with a kid-friendly test sentence. */
export const HOMOPHONE_HINTS = [
  { pair: ['their', 'there'], hint: "their = it belongs to them · there = a place. Try: 'their bag is over there.'" },
  { pair: ['your', "you're"], hint: "your = it belongs to you · you're = you are." },
  { pair: ['its', "it's"], hint: "its = it belongs to it · it's = it is." },
  { pair: ['then', 'than'], hint: "then = next · than = comparing ('bigger than')." },
  { pair: ['to', 'too', 'two'], hint: "to = towards · too = also/very · two = the number 2." },
  { pair: ['were', 'where'], hint: "were = we were there · where = which place?" },
  { pair: ['of', 'off'], hint: "of = belonging to · off = away from." },
  { pair: ['quiet', 'quite'], hint: "quiet = no noise · quite = a little bit / very." },
  { pair: ['lose', 'loose'], hint: "lose = can't find it · loose = not tight." },
  { pair: ['accept', 'except'], hint: "accept = take it · except = all but one." },
  { pair: ['affect', 'effect'], hint: "affect = changes something · effect = the change." },
  { pair: ['whole', 'hole'], hint: 'whole = all of it · hole = a gap.' },
];

/** Suffix hints used when no dictionary entry is available. */
export const SUFFIX_HINTS = [
  ['ology', 'the study of something'],
  ['ologist', 'a person who studies something'],
  ['tion', 'the act or process of doing something'],
  ['sion', 'the act or process of doing something'],
  ['ment', 'the result or act of something'],
  ['ness', 'the state of being something'],
  ['ity', 'the quality of being something'],
  ['able', 'can be done'],
  ['ible', 'can be done'],
  ['less', 'without something'],
  ['ful', 'full of something'],
  ['ism', 'a set of ideas or beliefs'],
  ['ist', 'a person who does or follows something'],
  ['graph', 'a drawing or recording'],
  ['meter', 'a measuring tool'],
  ['scope', 'a tool for looking at something'],
  ['phobia', 'a strong fear of something'],
];
