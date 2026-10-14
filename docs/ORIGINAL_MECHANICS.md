# How the original plays (reference notes)

Notes on the gameplay systems of the 1994 game as reimplemented by
[Pizza Legacy](https://codeberg.org/cowomaly/pizzalegacy), written from reading
that project's source. They describe **mechanics**, which we reimplement in our
own code. Pizza Online uses no original text, names, numbers tables, graphics or
characters: slogans, vendor names, taste values and art are all our own.

## Time

- The day advances in ten-minute blocks while the player works, and the player
  can end the day early ("end turn"). How long a day lasts for the owner depends
  on their energy.
- At the end of each day restaurants are processed and the player reviews the
  results before the next day starts.

## Characters

Every person in the game (owners, staff, contacts) is a character with the same
stat block: age, popularity, health, energy, intelligence, charisma, dexterity,
personality, courage, experience, trustworthiness, honesty (hidden), cooking,
serving, management, motivation, pizzas per day and starting money.

- The selection screen cycles through the cast with up/down arrows, shows the
  stat box (money, age, popularity, health, energy, intelligence, charisma,
  dexterity, personality, cooking, courage) next to a photo, lets you rename the
  character, and has a column to choose which company slots are human or computer.
- Popularity raises how much the bank will lend. Charisma and personality decide
  how well a manager handles staff. Intelligence and cooking feed into wages and
  food. Energy sets how long the owner's day is. Dexterity and courage matter for
  underworld actions.
- A staff member's starting wage grows with serving, the role's main skill
  (cooking for cooks, management for waiters and much more for managers),
  pizzas per day and trustworthiness, scaled up by intelligence.

## Staff

- Cooks, waiters and managers are hired from a job market whose pool of
  candidates rotates weekly.
- Staff have motivation, health, trustworthiness and honesty. Training courses
  (several levels each for cooking, serving and management) raise skills.
- Daily staff events: arriving late, calling in sick, long absences, asking for a
  raise, threatening to quit, theft, and personal events. Most open a dialog with
  three possible responses whose effects depend on the choice.
- A manager runs a daily routine for their restaurant: shopping for stock,
  adjusting prices, watching turnover, reporting staff shortages and influencing
  staff morale. Serious problems interrupt the owner's day.

## Pizzas

- Ingredients belong to categories (vegetables, meat & fish, fruit, cheese, plus
  herbs/spices) and each has a weight per piece size, calories, intensity and
  fat / sweet / salty / hot values.
- Each placed topping can be **rotated** and **chopped** (whole → chopped →
  minced, where the ingredient allows it). Chopping changes how it looks and its
  weight per piece.
- A recipe is scored on calories, flavour percentages (fat, sweet, salty, hot),
  **appearance** (how evenly toppings sit around the centre), **refinement**
  (how finely things are chopped), **normality** (variety and weight),
  **imitation** (how close it is to a classic reference pizza), a herb score,
  and the current ingredient **trend** in the city.
- Six customer groups (children, young people, blue collar, white collar,
  business people, seniors) each have a taste profile over fat, sweet, salty and
  hot. A recipe's flavour mix gives it a popularity score with each group.
- Recipes can be imported and exported; there is an annual pizza competition
  judged by a panel.

## Districts and demand

- Each district has its own mix of the six customer groups, average income,
  price level, rent level, premises size and availability, crime and traffic, a
  service-quality expectation and a desired number of standard and own pizzas on
  menus.
- Demand for a pizza in a district combines its popularity with the local groups,
  the trendiness of its four defining ingredients in the city, the district's
  economy, and a price penalty that grows steeply with price relative to income.
- A restaurant's popularity is the sum of components: waiting time (service speed
  versus the district's expectation), menu composition (enough classics, plus own
  creations), advertising, star rating, how much demand was actually fulfilled,
  and unexpected events.

## Purchasing stock

- The stock screen has a button per category. Each category has several vendors
  with their own quality, minimum order, delivery reliability and per-ingredient
  price levels (some don't sell every item).
- Choosing a vendor opens a big order table: every ingredient with its **price**
  (dashes when the vendor doesn't stock it), an **amount** to buy, the projected
  **stock**, and how many **days** that stock will last at current usage.
- Vendors can also be phoned to negotiate standing contracts.

## Advertising

Four channels per city, each with a duration, cost and effectiveness, and one
campaign per channel at a time. Effectiveness feeds restaurant popularity.

- **Flyers**: choose a print run (in steps of 100, up to 500).
- **Posters**: browse a gallery of poster designs and pick one.
- **Newspaper**: a slogan mini-game. Over five rounds you pick one of five
  sentence fragments; the offered window drifts between rounds. Fragments come in
  matching "families", and every switch of family halves the ad's multiplier, so
  a coherent slogan scores well. Then pick a size (half or full page) and colour
  (two or four colour), which set cost and effectiveness.
- **TV**: watch and choose one of several animated commercials.

## Restaurants

- Properties come from realtors (by phone) and their size depends on the lot.
- The restaurant view is a detailed floor plan: flooring, tables, chairs,
  decoration and kitchen equipment are bought from vendors with different
  quality, price and appeal to each customer group, kept in storage and placed.
- Guests walk in, sit and eat; stats screens show weekly takings and sales.

## City life and the world

- A daily newspaper reports events, some of which start ingredient trends.
- The mayor hands out yearly awards (most beautiful restaurant, pizza of the
  year, best investor, best imitator and more) and keeps a favour score that
  donations raise.
- Pizza charts rank the most popular pizzas in each city.
- Social status ranks rise with business success; awards come in several
  categories and levels.
- Each city has an economic trend that moves over the weeks.
- Banks offer loans with monthly repayments; insurance covers theft, warehouse,
  fire, liability and life.
- An optional underworld side (mafia jobs, an arms dealer, police) lets players
  sabotage rivals.
