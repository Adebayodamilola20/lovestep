// Between Us: question games for two. Every pack has at least 15 questions; a round draws 10.
// kind: 'likely' -> answer is a person (stored as a player index so both sides compare fairly)
//       'binary' -> two fixed options for the whole mode
//       'pair'   -> each question carries its own two options
//       'choice' -> each question carries 3-4 options
//       'guess'  -> each question carries options; you answer for yourself, then guess your partner

export const MODES = {
  likely: { id: 'likely', name: "Who's Most Likely To?", short: 'Most Likely To', kind: 'likely', tone: 'plum', blurb: 'Point at each other. Find out if you agree on who.' },
  agree: { id: 'agree', name: 'Agree or Disagree', short: 'Agree or Disagree', kind: 'binary', tone: 'indigo', options: ['Agree', 'Disagree'], blurb: 'One statement, two buttons. No fence-sitting.' },
  wyr: { id: 'wyr', name: 'Would You Rather', short: 'Would You Rather', kind: 'pair', tone: 'rust', blurb: 'Two options. Both a little painful.' },
  pick: { id: 'pick', name: 'Pick One', short: 'Pick One', kind: 'choice', tone: 'olive', blurb: 'Four choices. See if you land on the same one.' },
  tot: { id: 'tot', name: 'This or That?', short: 'This or That', kind: 'pair', tone: 'teal', blurb: 'Fast picks. Go with your gut.' },
  nhie: { id: 'nhie', name: 'Never Have I Ever', short: 'Never Have I Ever', kind: 'binary', tone: 'wine', options: ['I have', 'I have never'], blurb: 'Confess together. Compare after.' },
  // Once a guessing game; now you each just answer about yourself and compare at the end.
  guess: { id: 'guess', name: 'All About Me', short: 'All About Me', kind: 'choice', tone: 'gold', blurb: 'Answer about yourself. See what they picked and where you match.' },
  finish: { id: 'finish', name: 'Finish the Sentence', short: 'Finish the Sentence', kind: 'choice', tone: 'rose', blurb: 'Pick how the sentence ends. Match each other for points.' },
};

const P = (id, mode, title, q, extra = {}) => ({ id, mode, title, q, ...extra });

export const PACK_LIST = [
  /* ---------- Most likely to ---------- */
  P('likely-everyday', 'likely', 'Everyday us', [
    'Fall asleep during a movie we picked together', 'Forget where they parked', 'Eat the last slice without asking',
    'Spend an hour getting ready and still be late', 'Cry at an advert', 'Start a fight with the remote',
    'Reply to a text three days later', 'Buy something online at 2am', 'Talk to the dog more than to people',
    'Say "five more minutes" and mean an hour', 'Lose their keys inside the house', 'Leave a cup on every surface',
    'Hit snooze four times', 'Pretend to know the lyrics', 'Rearrange the furniture on a whim',
  ]),
  P('likely-world', 'likely', 'Out in the world', [
    'Make friends with a stranger in a queue', 'Get us lost on holiday', 'Haggle at a market and win',
    'Send food back at a restaurant', 'Get recognised by a waiter somewhere we have been once', 'Book a trip on a whim',
    'Go viral by accident', 'Lose their passport', 'Start dancing first at a wedding',
    'Talk their way into somewhere we were not invited', 'Get a sunburn on a cloudy day', 'Ask for directions instead of using maps',
    'Win a raffle', 'Bring back far too many souvenirs', 'Become the main character at a party',
  ]),
  P('likely-us', 'likely', 'About the two of us', [
    'Say "I love you" first after a fight', 'Plan the next date', 'Remember our anniversary without a reminder',
    'Get jealous over nothing', 'Steal the covers every night', 'Text "come home" while the other is out',
    'Keep the first gift forever', 'Want to stay in when the other wants to go out', 'Win every argument',
    'Propose a wild idea and actually follow through', 'Cry at our wedding first', 'Plan our future kids’ names',
    'Start the tickle fight', 'Check on the other when they are quiet', 'Tell our story wrong on purpose',
  ]),
  P('likely-late', 'likely', 'Late night (18+)', [
    'Make the first move tonight', 'Send a risky text at the worst moment', 'Suggest skipping dinner to stay in',
    'Get flustered by a compliment', 'Have a secret crush on a fictional character', 'Kiss in public without caring who sees',
    'Wear something just to get a reaction', 'Flirt with the other in front of friends', 'Be the one who says "we should go home"',
    'Leave a note with something cheeky in it', 'Whisper something to make the other blush', 'Pull the other in for a slow dance',
    'Steal a kiss mid-sentence', 'Plan a surprise night in', 'Get caught staring',
  ], { spicy: true }),
  P('likely-spicy', 'likely', 'Spicy most likely (18+)', [
    'Start something in the kitchen', 'Get distracted by the other in the shower', 'Send a voice note they should not play out loud',
    'Suggest an early night that is not about sleep', 'Bite their lip when they are thinking about the other', 'Leave a love bite',
    'Steal the other’s shirt to wear', 'Make the other miss their alarm', 'Text "are you alone?"',
    'Wear nothing but a smile', 'Turn a massage into something else', 'Lock the door without saying why',
    'Pull the other back into bed', 'Plan a hotel night just because', 'Forget the movie was even on',
  ], { spicy: true }),

  /* ---------- Agree or disagree ---------- */
  P('agree-love', 'agree', 'Love and dating', [
    'Couples should share their phone passcodes', 'Love at first sight is real', 'You should be best friends with your partner',
    'Going to bed angry is sometimes fine', 'Separate holidays are healthy', 'Exes can never really be friends',
    'Big gestures matter more than small ones', 'It is fine to look through a partner’s old photos', 'Every couple needs a weekly date night',
    'Saying sorry first means you lost', 'Couples should post each other online', 'Jealousy is a sign you care',
    'You should meet the family early', 'Long distance can work', 'There is one person for everyone',
  ]),
  P('agree-money', 'agree', 'Money and plans', [
    'Couples should have one joint account', 'Whoever earns more should pay more', 'Splitting the bill on a first date is fine',
    'Buying a house matters more than travelling', 'You should know your partner’s salary', 'Surprise purchases over a certain amount need a chat first',
    'Saving is more romantic than spending', 'It is okay to lend money to family without asking', 'Five-year plans are worth making',
    'Moving cities for a partner’s job is a fair ask', 'Debt should be shared once you are married', 'A big wedding is worth the cost',
    'Each person should keep some money private', 'Gifts should have a budget', 'Renting is not throwing money away',
  ]),
  P('agree-hot', 'agree', 'Hot takes', [
    'Pineapple belongs on pizza', 'Texting "k" is rude', 'Reality TV is better than most dramas',
    'Socks with sandals are fine at home', 'Cereal is a soup', 'Breakfast for dinner beats dinner for dinner',
    'Voice notes longer than one minute are a crime', 'Weddings are mostly for the guests', 'Morning people are suspicious',
    'The book is always better than the film', 'Jollof is better the next day', 'Read receipts should stay on',
    'Tea is better than coffee', 'Matching couple outfits are cute', 'Leaving someone on read is fine',
  ]),
  P('agree-ring', 'agree', 'Before the ring', [
    'You should live together before marriage', 'Both families must approve', 'Marriage changes a relationship',
    'You should agree on religion first', 'Prenups are sensible', 'Kids should be decided before the wedding',
    'Our parents’ marriages taught us what to avoid', 'You should travel together before getting engaged', 'A long engagement is better',
    'You should know each other’s past fully', 'Couples counselling before marriage is smart', 'The proposal should be a surprise',
    'Taking one surname matters', 'Friends should have a say', 'Love is enough to make it work',
  ]),
  P('agree-living', 'agree', 'Living together', [
    'Chores should be split exactly fifty-fifty', 'Each person needs a room of their own', 'Guests need a heads-up',
    'The bed should be made every morning', 'Pets are part of the deal', 'Separate blankets save relationships',
    'Whoever cooks does not wash up', 'Thermostat wars are worth fighting', 'Shoes off inside, always',
    'Family can stay for more than a week', 'Groceries should be shared', 'A cleaner is worth paying for',
    'Quiet time alone at home is needed', 'The TV belongs in the bedroom', 'Decorating should be a joint decision',
  ]),

  /* ---------- Would you rather ---------- */
  P('wyr-easy', 'wyr', 'Easy ones', [
    ['Have breakfast in bed', 'Have dinner on a rooftop'], ['Get a handwritten letter', 'Get a surprise visit'],
    ['Cook together', 'Order in and watch a series'], ['Go on a beach holiday', 'Go on a city break'],
    ['Have a pet cat', 'Have a pet dog'], ['Stay up talking all night', 'Wake up early for a sunrise walk'],
    ['Slow dance in the kitchen', 'Sing in the car'], ['Plan every detail', 'Figure it out as we go'],
    ['Matching outfits for a day', 'Matching tattoos forever'], ['Rainy day indoors', 'Snow day outside'],
    ['Get flowers', 'Get chocolate'], ['Movie marathon', 'Game night'],
    ['Breakfast date', 'Late night date'], ['Live by the sea', 'Live in the mountains'], ['Picnic', 'Road trip'],
  ]),
  P('wyr-hard', 'wyr', 'Impossible choices', [
    ['Know every thought I have', 'Never know what I am thinking'], ['Live by the sea and be broke', 'Live in the city and be rich'],
    ['Relive our first date', 'See one day from ten years ahead'], ['Lose your phone for a month', 'Lose your voice for a week'],
    ['Only text for a year', 'Only call for a year'], ['Have no secrets at all', 'Keep one secret forever'],
    ['Always be ten minutes late', 'Always be thirty minutes early'], ['Fight once a week and make up fast', 'Fight once a year and sulk for days'],
    ['Move abroad tomorrow', 'Never leave our city'], ['Win an argument every time', 'Always be right but never say so'],
    ['Read my diary', 'Let me read yours'], ['Forget our first kiss', 'Forget our first fight'],
    ['Have a rewind button', 'Have a pause button'], ['Be famous together', 'Be rich and unknown'], ['Never eat rice again', 'Never eat bread again'],
  ]),
  P('wyr-dates', 'wyr', 'Date nights', [
    ['Karaoke', 'Comedy show'], ['Picnic in the park', 'Fancy restaurant'], ['Cinema', 'Bowling'],
    ['Cooking class', 'Wine tasting'], ['Arcade', 'Museum'], ['Stargazing', 'Night drive'],
    ['Concert', 'Football match'], ['Pottery class', 'Escape room'], ['Spa day', 'Theme park'],
    ['Board games at home', 'Dancing out'], ['Paint and sip', 'Ice skating'], ['Beach bonfire', 'Rooftop bar'],
    ['Food market', 'Fine dining'], ['Drive-in movie', 'Open-air concert'], ['Boat ride', 'Hot air balloon'],
  ]),
  P('wyr-spicy', 'wyr', 'Spicy would you rather (18+)', [
    ['A slow kiss', 'A long hug'], ['Lights on', 'Candles only'], ['A massage', 'A bubble bath together'],
    ['Be kissed on the neck', 'Be kissed on the forehead'], ['A cheeky text at work', 'A note in your bag'], ['Stay in bed all morning', 'Shower together'],
    ['Dance close at a party', 'Dance close at home'], ['Wear their shirt', 'Have them wear yours'], ['Make out in the rain', 'Make out in the car'],
    ['Whispered compliments', 'A love letter'], ['Hotel weekend', 'Cabin weekend'], ['Be teased all day', 'Be surprised at night'],
    ['Matching pyjamas', 'No pyjamas'], ['Breakfast in bed', 'Dessert in bed'], ['First move from you', 'First move from me'],
  ], { spicy: true }),
  P('wyr-fantasy', 'wyr', 'Fantasy lab (18+)', [
    ['A secret getaway', 'A secret date in our own city'], ['Role-play strangers at a bar', 'Recreate our first date'],
    ['A weekend with no phones', 'A weekend with no plans'], ['Dress up for each other', 'Dress down for each other'],
    ['Midnight swim', 'Sunrise kiss'], ['Be blindfolded for a taste test', 'Do the blindfolding'],
    ['Write each other a fantasy', 'Read it out loud'], ['A private dance', 'A private serenade'],
    ['Spontaneous', 'Planned to the minute'], ['Somewhere new', 'Somewhere that means something'],
    ['Silk sheets', 'A cosy fireplace'], ['Talk about it first', 'Just let it happen'],
    ['A love song playlist', 'Total silence'], ['A slow evening', 'A wild night'], ['Leave marks', 'Leave notes'],
  ], { spicy: true }),

  /* ---------- Pick one ---------- */
  P('pick-day', 'pick', 'Our perfect day', [
    ['Perfect morning', 'Lie in', 'Gym together', 'Big breakfast out', 'Coffee and a walk'],
    ['Perfect afternoon', 'Shopping', 'Nap', 'Something outdoors', 'Seeing friends'],
    ['Perfect evening', 'Dinner out', 'Movie night', 'A party', 'Long bath and early night'],
    ['Weekend away', 'Beach', 'Mountains', 'Big city', 'Countryside cabin'],
    ['Soundtrack for the day', 'Afrobeats', 'R&B', 'Gospel', 'Pop'],
    ['Way to celebrate good news', 'Big dinner', 'Quiet night in', 'Call everyone', 'Buy something nice'],
    ['Best kind of gift', 'Something handmade', 'Something expensive', 'An experience', 'A surprise trip'],
    ['Ideal Sunday', 'Church then lunch', 'Sleep all day', 'Family visit', 'Plans with friends'],
    ['Perfect photo spot', 'Golden hour outside', 'Mirror selfie', 'Restaurant table', 'Candid in bed'],
    ['How the day ends', 'Talking in the dark', 'Falling asleep on the sofa', 'Late snack', 'Watching one more episode'],
    ['Rainy day plan', 'Films', 'Baking', 'Sleep', 'Games'],
    ['Best season', 'Harmattan', 'Rainy season', 'Summer', 'Christmas time'],
    ['Lunch spot', 'Home', 'Cafe', 'Buka', 'Park'],
    ['Outfit for the day', 'Matching', 'Comfy', 'Dressed up', 'Whatever is clean'],
    ['Afternoon snack', 'Puff-puff', 'Fruit', 'Ice cream', 'Crisps'],
  ]),
  P('pick-food', 'pick', 'Food and comfort', [
    ['Comfort food', 'Jollof rice', 'Pizza', 'Noodles', 'Burger'], ['Late night snack', 'Crisps', 'Ice cream', 'Toast', 'Leftovers'],
    ['Breakfast', 'Pancakes', 'Fry-up', 'Yam and egg', 'Smoothie'], ['Drink', 'Tea', 'Coffee', 'Juice', 'Something fizzy'],
    ['Dessert', 'Cake', 'Chocolate', 'Fruit', 'Skip dessert'], ['Takeaway night', 'Chinese', 'Indian', 'Suya', 'Chicken and chips'],
    ['Cooking style', 'Follow the recipe', 'Freestyle', 'Microwave master', 'Let the other cook'], ['Movie snack', 'Popcorn', 'Sweets', 'Nachos', 'Nothing'],
    ['Spice level', 'None', 'A little', 'Hot', 'Make me cry'], ['Fancy dinner order', 'Steak', 'Seafood', 'Pasta', 'Whatever the waiter says'],
    ['Soup', 'Egusi', 'Pepper soup', 'Tomato', 'Chicken noodle'], ['Swallow', 'Pounded yam', 'Eba', 'Amala', 'Fufu'],
    ['Street food', 'Suya', 'Boli', 'Shawarma', 'Corn'], ['Fruit', 'Mango', 'Pineapple', 'Watermelon', 'Banana'], ['Party food', 'Small chops', 'Fried rice', 'Moi moi', 'Cake'],
  ]),
  P('pick-travel', 'pick', 'Travel', [
    ['Dream trip', 'Japan', 'Italy', 'Ghana', 'Maldives'], ['Travel style', 'Planned to the minute', 'Loose plan', 'No plan', 'All-inclusive'],
    ['Where we stay', 'Hotel', 'Cabin', 'Friend’s place', 'Villa with a pool'], ['How we get there', 'Plane', 'Road trip', 'Train', 'Boat'],
    ['First thing on arrival', 'Nap', 'Find food', 'Explore', 'Pool'], ['Souvenir', 'Magnet', 'Clothes', 'Photos only', 'Local food'],
    ['Holiday pace', 'Do everything', 'Do nothing', 'Half and half', 'Depends on the weather'], ['Travel snack', 'Chin chin', 'Sweets', 'Fruit', 'Airport food'],
    ['Best part of a trip', 'Food', 'Views', 'Shopping', 'Nightlife'], ['Holiday photo', 'Sunset', 'Food', 'Couple selfie', 'Landmark'],
    ['Seat', 'Window', 'Aisle', 'Middle, next to you', 'Whatever is cheapest'], ['Luggage', 'One small bag', 'Two big cases', 'Borrow everything', 'Pack the night before'],
    ['Honeymoon', 'Zanzibar', 'Paris', 'Bali', 'Cape Town'], ['Adventure', 'Safari', 'Skydiving', 'Hiking', 'Scuba'], ['Who plans', 'Me', 'You', 'Both', 'A travel agent'],
  ]),
  P('pick-future', 'pick', 'Our future', [
    ['Where we live in ten years', 'Lagos', 'Abroad', 'A quiet town', 'Wherever work takes us'], ['Our home', 'Flat in the city', 'House with a garden', 'Build our own', 'Somewhere by the water'],
    ['How many kids', 'None', 'One or two', 'Three or four', 'Let’s see'], ['Wedding size', 'Just us', 'Small', 'Big', 'Owambe'],
    ['Wedding season', 'December', 'Easter', 'Summer', 'Whenever is cheapest'], ['Family pet', 'Dog', 'Cat', 'Fish', 'No pets'],
    ['Our Sundays', 'Church and lunch', 'Brunch', 'Family visits', 'Rest'], ['Who handles money', 'Me', 'You', 'Both together', 'An app'],
    ['Retirement', 'By the beach', 'Near the grandkids', 'Travelling', 'Never retire'], ['First big purchase', 'A car', 'A house', 'A trip', 'Investments'],
    ['Anniversary tradition', 'Same restaurant', 'New city', 'Quiet dinner at home', 'Re-read our letters'], ['Arguments get settled', 'Talk it out now', 'Sleep on it', 'Write it down', 'Ask a friend'],
    ['Biggest goal together', 'Travel the world', 'Start a business', 'Build a family', 'Buy a home'], ['Our car', 'Something practical', 'Something fast', 'Something electric', 'Share one'],
    ['Holidays with family', 'Every year', 'Some years', 'Rarely', 'They visit us'],
  ]),

  /* ---------- This or that ---------- */
  P('tot-quick', 'tot', 'Quick fire', [
    ['Call', 'Text'], ['Sunrise', 'Sunset'], ['Sweet', 'Salty'], ['Netflix', 'YouTube'], ['Summer', 'Winter'],
    ['Cats', 'Dogs'], ['Early bird', 'Night owl'], ['Sneakers', 'Heels'], ['Books', 'Podcasts'], ['Hugs', 'Kisses'],
    ['Android', 'iPhone'], ['Beach', 'Pool'], ['Burger', 'Pizza'], ['Instagram', 'TikTok'], ['Comedy', 'Horror'],
  ]),
  P('tot-home', 'tot', 'Home life', [
    ['Cook', 'Wash up'], ['Tidy now', 'Tidy later'], ['Big bed', 'Big sofa'], ['Fan', 'Air con'], ['Shower', 'Bath'],
    ['Plants', 'Pets'], ['Candles', 'Fairy lights'], ['City flat', 'House with a garden'], ['Window open', 'Window shut'], ['Morning routine', 'Night routine'],
    ['Left side of the bed', 'Right side of the bed'], ['Laundry', 'Dishes'], ['Music on', 'Quiet'], ['Guests over', 'Just us'], ['Order in', 'Cook in'],
  ]),
  P('tot-nostalgia', 'tot', 'Nostalgia', [
    ['Old songs', 'New songs'], ['Childhood cartoons', 'Childhood games'], ['Photo albums', 'Phone gallery'], ['First date', 'First kiss'], ['School days', 'Holidays'],
    ['Handwritten notes', 'Voice notes'], ['Disposable camera', 'Phone camera'], ['Old phone', 'New phone'], ['Hometown', 'Where we live now'], ['How we met', 'How we got together'],
    ['Tom and Jerry', 'Spongebob'], ['Ludo', 'Whot'], ['Boarding school stories', 'Day school stories'], ['Christmas morning', 'Birthday morning'], ['First crush', 'First heartbreak'],
  ]),

  /* ---------- Never have I ever ---------- */
  P('nhie-mild', 'nhie', 'Mild', [
    'Pretended to like a gift', 'Stalked an ex online', 'Laughed at a funeral', 'Lied about my age', 'Cried at a cartoon',
    'Sent a text to the wrong person', 'Fallen asleep in class or at work', 'Re-gifted a present', 'Faked being sick to skip something', 'Sung in the shower loud enough for neighbours',
    'Eaten food that fell on the floor', 'Forgotten someone’s name mid-conversation', 'Walked into a glass door', 'Googled myself', 'Pretended to be on the phone to avoid someone',
  ]),
  P('nhie-dating', 'nhie', 'Dating history', [
    'Been on a blind date', 'Ghosted someone', 'Been ghosted', 'Dated two people in the same month', 'Gone back to an ex',
    'Kissed someone on the first date', 'Slid into someone’s DMs', 'Fallen for a friend', 'Been the one to end things', 'Written a love letter',
    'Lied about where I was on a date night', 'Had a crush on a teacher', 'Been set up by my family', 'Used a dating app', 'Said "I love you" first',
  ]),
  P('nhie-spicy', 'nhie', 'After dark (18+)', [
    'Sent a photo I would not want my mum to see', 'Kissed someone in a club', 'Had a crush on a friend’s partner', 'Skinny dipped', 'Woken up not sure where I was',
    'Flirted my way out of trouble', 'Had a holiday romance', 'Made out in a car', 'Said "I love you" just to see the reaction', 'Planned a whole night in just for two',
    'Kissed a stranger', 'Been caught kissing', 'Worn something just to be noticed', 'Had a dream about you that I never told you', 'Sent a text and deleted it before it was seen',
  ], { spicy: true }),
  P('nhie-spicy2', 'nhie', 'Spicy never have I ever (18+)', [
    'Kissed in a lift', 'Fantasised about someone famous', 'Sent a flirty voice note', 'Left a love bite', 'Missed a plan because I stayed in bed',
    'Dressed up in a costume for someone', 'Kissed in the rain', 'Had a secret relationship', 'Lied about my number', 'Read something steamy in public',
    'Written something steamy', 'Danced on a table', 'Snuck out at night', 'Flirted with a waiter for a free dessert', 'Been told I am a good kisser',
  ], { spicy: true }),
  P('nhie-confess', 'nhie', 'Confessions (18+)', [
    'Kept a secret from you for more than a week', 'Checked your phone', 'Pretended to be asleep to avoid a chat', 'Been jealous of one of your friends', 'Hidden a purchase',
    'Re-read our old messages', 'Practised a conversation with you in the mirror', 'Told my friends about our fight', 'Lied about liking a meal you cooked', 'Thought about our wedding before we were serious',
    'Saved a screenshot of something you said', 'Missed you while you were in the next room', 'Planned a surprise and chickened out', 'Cried over us', 'Wanted to say sorry and didn’t',
  ], { spicy: true }),

  /* ---------- How well do you know me (guessing) ---------- */
  P('guess-basics', 'guess', 'The basics', [
    ['My comfort food', 'Jollof rice', 'Pizza', 'Noodles', 'Burger'], ['My favourite way to relax', 'Sleep', 'Music', 'TV', 'Going out'],
    ['My dream holiday', 'Beach', 'City', 'Safari', 'Snowy cabin'], ['My biggest fear', 'Heights', 'Spiders', 'The dark', 'Losing people'],
    ['My love language', 'Words', 'Touch', 'Gifts', 'Quality time'], ['My go-to drink', 'Tea', 'Coffee', 'Juice', 'Fizzy'],
    ['My favourite season', 'Harmattan', 'Rainy', 'Summer', 'Christmas time'], ['My morning mood', 'Sunshine', 'Leave me alone', 'Need coffee', 'Already on the phone'],
    ['My favourite colour', 'Black', 'Red', 'Blue', 'Green'], ['My ideal date', 'Dinner out', 'Movie at home', 'Something active', 'Road trip'],
    ['My pet peeve', 'Lateness', 'Loud chewing', 'Being ignored', 'Mess'], ['My hidden talent', 'Singing', 'Cooking', 'Dancing', 'Drawing'],
    ['My favourite film type', 'Romance', 'Comedy', 'Action', 'Horror'], ['How I handle stress', 'Talk it out', 'Go quiet', 'Eat', 'Sleep'],
    ['My social battery', 'Always on', 'Needs charging after parties', 'Homebody', 'Depends on the day'],
  ]),
  P('guess-deep', 'guess', 'Deeper', [
    ['What makes me feel most loved', 'Being told', 'Being held', 'Being helped', 'Being remembered'], ['When I am upset I want', 'Space', 'A hug', 'Advice', 'Distraction'],
    ['My biggest dream', 'Family', 'Career', 'Travel', 'Peace of mind'], ['What I worry about most', 'Money', 'Health', 'Family', 'The future'],
    ['My proudest moment so far', 'School', 'Work', 'Family', 'Something just for me'], ['The way I say sorry', 'Words', 'A gift', 'Doing something nice', 'Acting normal'],
    ['What I need after a bad day', 'Food', 'Quiet', 'A long talk', 'Sleep'], ['What I value most in us', 'Trust', 'Fun', 'Loyalty', 'Growth'],
    ['A perfect anniversary for me', 'Surprise trip', 'Quiet dinner', 'Big party', 'Letters'], ['My first impression of you', 'Cute', 'Funny', 'Serious', 'Mysterious'],
    ['What I would change about my past', 'Nothing', 'Studied harder', 'Travelled more', 'Spoken up more'], ['My idea of success', 'Money', 'Happiness', 'Respect', 'Freedom'],
    ['How I show love most', 'Words', 'Touch', 'Gifts', 'Doing things'], ['What I find hardest to say', 'Sorry', 'I need help', 'I love you', 'No'],
    ['Where I feel most at home', 'With family', 'With you', 'Alone', 'With friends'],
  ]),
  P('guess-afterdark', 'guess', 'About us (after dark) (18+)', [
    ['My favourite place to be kissed', 'Lips', 'Neck', 'Forehead', 'Hand'], ['My ideal night in', 'Film and cuddles', 'Bath for two', 'Dancing at home', 'Talking till late'],
    ['What I notice first about you', 'Eyes', 'Smile', 'Voice', 'Smell'], ['My favourite outfit on you', 'Dressed up', 'Comfy', 'My clothes', 'Nothing fancy'],
    ['When I feel most attracted to you', 'When you laugh', 'When you are confident', 'When you care for me', 'When you dress up'], ['My kind of romance', 'Slow', 'Spontaneous', 'Playful', 'Intense'],
    ['Best time for a kiss', 'Morning', 'Goodbye', 'Hello', 'Midnight'], ['My favourite compliment', 'You look good', 'You are smart', 'You make me laugh', 'You are kind'],
    ['What sets the mood for me', 'Music', 'Candles', 'Words', 'Touch'], ['My dream getaway for two', 'Beach villa', 'City hotel', 'Mountain cabin', 'At home, phones off'],
    ['How I like to be woken up', 'Kisses', 'Breakfast', 'Cuddles', 'Let me sleep'], ['My flirting style', 'Teasing', 'Compliments', 'Eye contact', 'Touch'],
    ['The song that is ours', 'A slow jam', 'Afrobeats', 'Old school', 'Gospel'], ['What I would wear for you', 'Something red', 'Something black', 'Your shirt', 'Surprise'],
    ['My favourite memory of us', 'First date', 'First kiss', 'A trip', 'A quiet night'],
  ], { spicy: true }),

  /* ---------- Finish the sentence ---------- */
  P('finish-us', 'finish', 'About us', [
    ['The first thing I noticed about you was', 'Your smile', 'Your eyes', 'Your laugh', 'Your style'], ['Our relationship is like', 'A movie', 'A rollercoaster', 'A warm blanket', 'A party'],
    ['The best part of my day is', 'Morning texts', 'Seeing you', 'Night calls', 'Weekends'], ['I fell for you when', 'We first talked', 'You made me laugh', 'You looked after me', 'I still am falling'],
    ['Our song should be', 'A love ballad', 'An Afrobeats hit', 'A gospel song', 'Something silly'], ['If we were a food we would be', 'Jollof and chicken', 'Pizza', 'Suya', 'Ice cream'],
    ['The thing I love most about us is', 'We laugh', 'We talk', 'We grow', 'We are loyal'], ['When we fight we usually', 'Talk it out', 'Go quiet', 'Laugh it off', 'Sleep on it'],
    ['Our next adventure should be', 'A trip', 'A new hobby', 'A big move', 'A cosy year'], ['People think we are', 'Twins', 'Opposites', 'Married already', 'Best friends'],
    ['You make me feel', 'Safe', 'Seen', 'Excited', 'Calm'], ['The cutest thing you do is', 'Your laugh', 'Your texts', 'Your sleepy face', 'Your dance'],
    ['Our ideal Friday night is', 'Out with friends', 'In with food', 'Date night', 'Early sleep'], ['The thing we do best together is', 'Eat', 'Travel', 'Talk', 'Laugh'],
    ['Ten years from now we will be', 'Married with kids', 'Travelling', 'Running a business', 'Still this silly'],
  ]),
  P('finish-memories', 'finish', 'Memories', [
    ['Our best date so far was', 'Dinner', 'A trip', 'Staying in', 'The first one'], ['The moment I knew was', 'Our first call', 'Our first date', 'A hard day', 'I always knew'],
    ['Our funniest moment was', 'Getting lost', 'A food disaster', 'A wrong text', 'A dance off'], ['The gift I treasure most is', 'A letter', 'Jewellery', 'Clothes', 'Your time'],
    ['Our first argument was about', 'Something small', 'Time', 'Friends', 'Nothing really'], ['My favourite photo of us is', 'A selfie', 'A candid', 'A group one', 'Not taken yet'],
    ['The song that reminds me of us is', 'A slow one', 'A party one', 'An old one', 'Our first dance'], ['The place that feels like us is', 'Your house', 'A restaurant', 'Our city', 'Anywhere together'],
    ['Our most romantic moment was', 'A surprise', 'A late talk', 'A trip', 'A small gesture'], ['The meal we always talk about is', 'Street food', 'A fancy dinner', 'Home cooking', 'A fast food run'],
    ['Our first kiss felt', 'Magical', 'Awkward', 'Nervous', 'Perfect'], ['The trip I want to repeat is', 'Our first', 'Our last', 'The beach one', 'Not taken yet'],
    ['The text I still remember is', 'The first', 'A goodnight', 'An apology', 'A silly meme'], ['Our wildest night was', 'A party', 'A road trip', 'A long talk', 'Coming soon'],
    ['The day I will never forget is', 'Our first meeting', 'An anniversary', 'A holiday', 'Today'],
  ]),
];

export const PACKS = Object.fromEntries(PACK_LIST.map((p) => [p.id, p]));
export const packsFor = (mode) => PACK_LIST.filter((p) => p.mode === mode);

/** Hub sections below "Play together", like the editions in a magazine. */
export const COLLECTIONS = [
  { id: 'before-ring', section: 'Before you…', title: 'Before the Ring', tone: 'olive', packs: ['agree-ring', 'pick-future'] },
  { id: 'discuss', section: 'Before you…', title: 'Discuss Before…', tone: 'rust', packs: ['agree-money', 'agree-living'] },
  { id: 'spicy-wyr', section: 'Spicy editions', title: 'Spicy Would You Rather', tone: 'rust', packs: ['wyr-spicy'], spicy: true },
  { id: 'spicy-nhie', section: 'Spicy editions', title: 'Spicy Never Have I Ever', tone: 'olive', packs: ['nhie-spicy2', 'nhie-spicy'], spicy: true },
  { id: 'spicy-likely', section: 'Spicy editions', title: "Spicy Who's Most Likely", tone: 'indigo', packs: ['likely-spicy', 'likely-late'], spicy: true },
  { id: 'confessions', section: 'After dark', title: 'Confessions', tone: 'wine', packs: ['nhie-confess'], spicy: true },
  { id: 'fantasy', section: 'After dark', title: 'Fantasy Lab', tone: 'teal', packs: ['wyr-fantasy'], spicy: true },
  { id: 'about-us', section: 'After dark', title: 'About Us (After Dark)', tone: 'rust', packs: ['guess-afterdark'], spicy: true, wide: true },
  { id: 'finish', section: 'Just between us', title: 'Finish the Sentence', tone: 'rose', packs: ['finish-us', 'finish-memories'], wide: true },
  { id: 'know-me', section: 'Just between us', title: 'All About Me', tone: 'gold', packs: ['guess-basics', 'guess-deep'], wide: true },
];

/** Normalise one question to { text, options } for display. */
export function question(pack, index, partnerName = 'Them') {
  const mode = MODES[pack.mode];
  const q = pack.q[index];
  switch (mode.kind) {
    case 'likely': return { text: `Who's most likely to ${lowerFirst(q)}?`, options: ['Me', partnerName] };
    case 'binary': return { text: mode.id === 'nhie' ? `Never have I ever ${lowerFirst(q)}` : q, options: mode.options };
    case 'pair': return { text: mode.id === 'wyr' ? 'Would you rather' : 'This or that?', options: q };
    case 'choice': return { text: mode.id === 'finish' ? `${q[0]}…` : q[0], options: q.slice(1) };
    case 'guess': return { text: q[0], options: q.slice(1) };
    default: return { text: String(q), options: [] };
  }
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
