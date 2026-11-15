import type { Field, PageSpec, SectionSpec, TextField } from './content.types';

type Opts = Partial<Pick<TextField, 'max' | 'hint' | 'required'>>;

// Wording is the design prototype's. Things the prototype left as [placeholders] default to
// empty and the website hides empty blocks, so nothing like "[N]" ever shows on the live site.
// "*word*" in a heading makes that word italic gold (see the website's <Emphasis>).

const t = (key: string, label: string, o: Opts = {}): Field => ({ type: 'text', key, label, ...o });
const ta = (key: string, label: string, o: Opts = {}): Field => ({ type: 'textarea', key, label, ...o });
const img = (key: string, label: string, hint?: string): Field => ({ type: 'image', key, label, hint });
const list = (key: string, label: string, itemLabel: string, max: number, fields: Field[], hint?: string): Field => ({ type: 'list', key, label, itemLabel, max, fields, hint });

const EM_HINT = 'Put *asterisks* around a word to make it italic gold.';
const eyebrow = t('eyebrow', 'Small heading above');

const home: SectionSpec[] = [
  {
    key: 'hero', title: 'Hero (top of the home page)',
    fields: [eyebrow, t('headline', 'Headline', { max: 120, hint: EM_HINT, required: true }), ta('body', 'Paragraph', { max: 400 }), t('primary_label', 'Main button text', { max: 40 }), t('secondary_label', 'Second button text', { max: 40 }), img('image', 'Hero photo', 'Optional. Without it the illustrated bottles are shown.')],
    defaults: { eyebrow: 'Perfumery & fragrance house · India', headline: 'Find the scent that *stays* with you.', body: 'Our own SmellMe Originals beside the world’s finest houses and India’s classic attars. Try any fragrance as a 2 ml sample before you buy the full bottle.', primary_label: 'Shop fragrances', secondary_label: 'Take the scent quiz', image: '' },
  },
  {
    key: 'trust', title: 'Trust strip (four reassurances)',
    fields: [list('items', 'Reassurances', 'reassurance', 4, [t('title', 'Title', { max: 40, required: true }), t('sub', 'Small text', { max: 80 })])],
    defaults: { items: [
      { title: '100% authentic', sub: 'Sourced from brands & authorised distributors' },
      { title: 'Sample first', sub: 'Every scent available as a 2 ml vial' },
      { title: 'Pay by UPI', sub: 'Scan, pay, upload the receipt' },
      { title: 'Delivered across India', sub: 'Check your pincode at checkout' },
    ] },
  },
  { key: 'families', title: 'Shop by scent family', description: 'The families themselves are managed under Brands, families & notes.', fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT })], defaults: { eyebrow: 'Shop by scent family', heading: 'What do you love to smell?' } },
  { key: 'bestsellers', title: 'Most loved products', description: 'Shows your Featured products, the newest ones, and everything under ₹2,500.', fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT })], defaults: { eyebrow: 'Most loved', heading: 'Fragrances everyone asks about' } },
  {
    key: 'originals', title: 'SmellMe Originals feature',
    fields: [eyebrow, t('heading', 'Heading', { max: 140, hint: EM_HINT }), ta('body', 'Paragraph', { max: 600 }), img('image_1', 'Photo 1 (arch)'), img('image_2', 'Photo 2'), list('stats', 'Highlights', 'highlight', 4, [t('value', 'Number or word', { max: 20, required: true }), t('label', 'Caption', { max: 50 })], 'e.g. 6 — signature scents. Leave empty to hide.'), t('cta_label', 'Button text', { max: 40 })],
    defaults: { eyebrow: 'SmellMe Originals', heading: 'Our own line, composed around *Indian* ingredients.', body: 'Vetiver after the first monsoon rain, Kashmiri saffron at dusk, jasmine picked before sunrise. Each SmellMe Original is made to last in our heat and humidity, and is sold at a fair price.', image_1: '', image_2: '', stats: [], cta_label: 'Explore the Originals' },
  },
  {
    key: 'discovery', title: 'Discovery Set card',
    fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT }), ta('body', 'Paragraph', { max: 400 }), t('price_text', 'Price text', { max: 30, hint: 'e.g. ₹999. Leave empty to hide.' }), t('cta_label', 'Button text', { max: 40 })],
    defaults: { eyebrow: 'Try before you commit', heading: 'The Discovery Set', body: 'Pick any 6 fragrances as 2 ml vials. Love one? The cost of the set comes off your full bottle.', price_text: '', cta_label: 'Build your set' },
  },
  {
    key: 'quiz', title: 'Scent finder card',
    fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT }), ta('body', 'Paragraph', { max: 400 }), list('steps', 'Steps', 'step', 5, [t('text', 'Step', { max: 80, required: true })]), t('cta_label', 'Button text', { max: 40 })],
    defaults: { eyebrow: 'Scent finder', heading: 'Not sure where to begin?', body: 'Answer five quick questions about places, moods and moments, and we’ll match you with three fragrances to sample.', steps: [{ text: 'Tell us what you love' }, { text: 'Get three matches' }, { text: 'Sample them at home' }], cta_label: 'Start the quiz' },
  },
  {
    key: 'moments', title: 'Shop by moment',
    fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT }), list('items', 'Moments', 'moment', 8, [t('label', 'Title', { max: 40, required: true }), t('sub', 'Small text', { max: 80 })])],
    defaults: { eyebrow: 'Shop by moment', heading: 'A scent for every occasion', items: [
      { label: 'Office hours', sub: 'Clean, close to the skin' }, { label: 'Date night', sub: 'Warm, a little daring' },
      { label: 'Wedding season', sub: 'Rich florals & oud that last' }, { label: 'Summer days', sub: 'Bright citrus for the heat' },
      { label: 'Monsoon', sub: 'Earthy, green, rain-soaked' },
    ] },
  },
  {
    key: 'guides', title: 'Fragrance guide',
    fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT }), list('items', 'Articles', 'article', 6, [t('tag', 'Tag', { max: 30 }), t('title', 'Title', { max: 120, required: true }), img('image', 'Picture')])],
    defaults: { eyebrow: 'The fragrance guide', heading: 'Learn to wear it well', items: [
      { tag: 'Basics', title: 'Parfum, EDP, EDT or attar — which should you buy?', image: '' },
      { tag: 'Wear it longer', title: 'How to make perfume last through an Indian summer', image: '' },
      { tag: 'Layering', title: 'Layering 101: pairing an attar with a modern perfume', image: '' },
    ] },
  },
  { key: 'newsletter', title: 'Newsletter box', fields: [t('kicker', 'Small italic line'), t('heading', 'Heading', { max: 140, hint: EM_HINT })], defaults: { kicker: 'The SmellMe letter', heading: 'New launches, restocks and a free sample on your birthday.' } },
];

const gifting: SectionSpec[] = [
  { key: 'hero', title: 'Hero', fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT, required: true }), ta('body', 'Paragraph', { max: 400 })], defaults: { eyebrow: 'Gifting', heading: 'Gifts that *linger*.', body: 'Hand-wrapped in our ivory box with a handwritten note. Add an engraving and it becomes theirs alone.' } },
  {
    key: 'sets', title: 'Gift sets',
    description: 'Each set can link to a product page (enter its web address, e.g. saffron-dusk) so customers can buy it.',
    fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT }), list('items', 'Sets', 'gift set', 8, [t('name', 'Name', { max: 60, required: true }), t('tag', 'Tag', { max: 30 }), ta('description', 'Description', { max: 240 }), t('price_text', 'Price text', { max: 30, hint: 'e.g. ₹1,499' }), t('product_slug', 'Product web address', { max: 140, hint: 'Optional: the product customers add to the bag' }), img('image', 'Picture')])],
    defaults: { eyebrow: 'Gift sets', heading: 'Ready to give', items: [
      { name: 'The Discovery Set', tag: 'Most gifted', description: 'Six 2 ml vials of your choice, with a voucher for the full bottle.', price_text: '', product_slug: '', image: '' },
      { name: 'Attar Trio', tag: 'Heritage', description: 'Rose, mitti and sandal attars in a carved wooden case.', price_text: '', product_slug: '', image: '' },
      { name: 'His & Hers Duo', tag: 'For couples', description: 'Two 30 ml bottles chosen to complement each other.', price_text: '', product_slug: '', image: '' },
      { name: 'Travel Wardrobe', tag: 'On the go', description: 'Four 10 ml travel sprays for day, night, work and weekends.', price_text: '', product_slug: '', image: '' },
    ] },
  },
  { key: 'personalise', title: 'Engraving, note & wrapping', fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT }), t('wrap_price_text', 'Gift wrap price text', { max: 30, hint: 'e.g. ₹150. Leave empty to hide.' })], defaults: { eyebrow: 'Make it personal', heading: 'Engraving, a note & wrapping', wrap_price_text: '' } },
  {
    key: 'occasions', title: 'Gift by occasion',
    fields: [t('heading', 'Heading', { hint: EM_HINT }), list('items', 'Occasions', 'occasion', 8, [t('label', 'Name', { max: 40, required: true }), img('image', 'Picture')])],
    defaults: { heading: 'Gift by occasion', items: [{ label: 'Diwali', image: '' }, { label: 'Weddings', image: '' }, { label: 'Birthdays', image: '' }, { label: 'Anniversaries', image: '' }, { label: 'Raksha Bandhan', image: '' }] },
  },
  { key: 'corporate', title: 'Corporate & wedding gifting', fields: [eyebrow, t('heading', 'Heading', { max: 160 }), t('cta_label', 'Button text', { max: 40 })], defaults: { eyebrow: 'Corporate & wedding gifting', heading: 'Gifting for 25 or more? We’ll create custom boxes with your logo.', cta_label: 'Request a quote' } },
];

const about: SectionSpec[] = [
  { key: 'hero', title: 'Hero', fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT, required: true }), ta('body', 'Founder story', { max: 800, hint: 'Two or three sentences on why SmellMe started. Leave empty to hide.' })], defaults: { eyebrow: 'Our story', heading: 'Perfume should be *tried*, not guessed.', body: '' } },
  {
    key: 'story', title: 'Two shelves, one promise',
    fields: [t('kicker', 'Small italic line'), t('heading', 'Heading', { hint: EM_HINT }), ta('paragraph_1', 'First paragraph', { max: 800 }), ta('paragraph_2', 'Second paragraph', { max: 800 }), img('image', 'Photo (founder / studio)')],
    defaults: { kicker: 'Two shelves, one promise', heading: 'The world’s houses beside our own', paragraph_1: 'On one shelf, fragrances from houses we admire — each one sourced from the brand or its authorised distributor. On the other, SmellMe Originals: our own perfumes, composed around Indian ingredients and made to last in Indian weather.', paragraph_2: 'Everything is available as a sample, because the only way to know a fragrance is to live in it for a day.', image: '' },
  },
  {
    key: 'values', title: 'What we stand for',
    fields: [t('heading', 'Heading'), list('items', 'Values', 'value', 6, [t('title', 'Title', { max: 40, required: true }), ta('body', 'Text', { max: 240 })])],
    defaults: { heading: 'What we stand for', items: [
      { title: 'Authentic, always', body: 'Sealed bottles with batch codes, sourced only from brands and authorised distributors.' },
      { title: 'Sample first', body: 'Every fragrance as a 2 ml vial, so you never pay for a full bottle you won’t wear.' },
      { title: 'Kept with care', body: 'Stored away from heat and light so each bottle smells the way its perfumer intended.' },
      { title: 'Rooted in India', body: 'Attars and Indian ingredients sit proudly beside the world’s great houses.' },
    ] },
  },
  {
    key: 'steps', title: 'How an Original is made',
    description: 'Leave the text of a step empty and it is hidden; the whole block disappears if all are empty.',
    fields: [eyebrow, t('heading', 'Heading'), list('items', 'Steps', 'step', 6, [t('title', 'Title', { max: 40, required: true }), ta('body', 'Text', { max: 300 })])],
    defaults: { eyebrow: 'How an Original is made', heading: 'From raw ingredient to your wrist', items: [{ title: 'Source', body: '' }, { title: 'Compose', body: '' }, { title: 'Mature', body: '' }, { title: 'Bottle by hand', body: '' }] },
  },
  { key: 'visit', title: 'Visit us', description: 'Hidden until you enter a place name.', fields: [eyebrow, t('place', 'Store or studio name, city'), t('details', 'Address and opening hours', { max: 300 }), t('cta_label', 'Button text', { max: 40 })], defaults: { eyebrow: 'Visit us', place: '', details: '', cta_label: 'Shop online' } },
];

const help: SectionSpec[] = [
  { key: 'hero', title: 'Hero', fields: [eyebrow, t('heading', 'Heading', { hint: EM_HINT, required: true })], defaults: { eyebrow: 'Help centre', heading: 'How can we help?' } },
  {
    key: 'faq', title: 'Questions & answers',
    description: 'Topics appear as tabs; the first question of each topic starts open.',
    fields: [list('categories', 'Topics', 'topic', 10, [t('name', 'Topic name', { max: 40, required: true }), list('faqs', 'Questions', 'question', 20, [t('q', 'Question', { max: 160, required: true }), ta('a', 'Answer', { max: 1200 })])])],
    defaults: { categories: [
      { name: 'Orders & payment', faqs: [
        { q: 'How do I pay?', a: 'At checkout you’ll see our UPI QR code and the exact amount to pay. Pay with any UPI app, then upload a screenshot of the payment receipt.' },
        { q: 'When does my order ship?', a: 'We check your receipt and confirm the payment first, then pack and ship your order. You’ll get a WhatsApp message at each step.' },
        { q: 'Do you offer cash on delivery?', a: 'No. Orders are paid by UPI before they ship.' },
        { q: 'Can I change my delivery address after ordering?', a: 'Contact us before the order is shipped and we will update it.' },
      ] },
      { name: 'Authenticity', faqs: [{ q: 'Are your perfumes genuine?', a: 'Every bottle is sourced from the brand or its authorised distributor in India and arrives sealed with its batch code.' }] },
      { name: 'Samples & discovery', faqs: [{ q: 'How do samples work?', a: 'Any fragrance can be bought as a 2 ml vial — enough to wear for several days and decide if you love it.' }] },
    ] },
  },
  { key: 'contact', title: '“Still need us?” box', description: 'The phone, WhatsApp and email shown here are set under Site & footer.', fields: [t('heading', 'Heading'), ta('body', 'Paragraph', { max: 400 })], defaults: { heading: 'Still need us?', body: 'Our fragrance advisors can also help you choose — tell them what you already love.' } },
];

const site: SectionSpec[] = [
  {
    key: 'site', title: 'Site & footer',
    fields: [
      t('announcement', 'Top bar message', { max: 120, hint: 'The dark strip above the menu. Leave empty to hide it.' }),
      ta('tagline', 'Footer description', { max: 300 }),
      t('whatsapp', 'WhatsApp number', { max: 30, hint: 'With country code, e.g. +91 98765 43210' }),
      t('phone', 'Phone number', { max: 30 }), t('email', 'Email', { max: 120 }), t('hours', 'Support hours', { max: 80 }),
      t('instagram', 'Instagram link', { max: 200 }), t('youtube', 'YouTube link', { max: 200 }),
    ],
    defaults: { announcement: 'Free 2 ml samples with every order · Delivered across India', tagline: 'Authentic perfumes, attars and our own SmellMe Originals. Sample first, then buy the bottle you love.', whatsapp: '', phone: '', email: '', hours: 'Mon–Sat, 10 am – 7 pm IST', instagram: '', youtube: '' },
  },
];

export const CONTENT_PAGES: PageSpec[] = [
  { key: 'home', title: 'Home page', sections: home },
  { key: 'gifting', title: 'Gifting page', sections: gifting },
  { key: 'about', title: 'Our story page', sections: about },
  { key: 'help', title: 'Help & FAQ page', sections: help },
  { key: 'site', title: 'Site & footer', sections: site },
];

export const findPage = (key: string) => CONTENT_PAGES.find((p) => p.key === key);
export const findSection = (page: string, section: string) => findPage(page)?.sections.find((s) => s.key === section);
