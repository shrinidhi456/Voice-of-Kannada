export interface ScenarioMessage {
  kannada: string;
  romanization: string;
  english: string;
}

export interface Scenario {
  id: string;
  title: string;
  kannadaTitle: string;
  tag: string;
  role: string;
  characterName: string;
  characterTitle: string;
  icon: string;
  description: string;
  dialoguePreview: string;
  firstMessage: ScenarioMessage;
  systemPrompt: string;
  bgGradient: string;
  accentColor: string;
  badgeColor: string;
}

export const SCENARIOS: Record<string, Scenario> = {
  auto: {
    id: "auto",
    title: "Auto-rickshaw",
    kannadaTitle: "ಆಟೋ ರಿಕ್ಷಾ",
    tag: "Everyday Travel",
    role: "A lively and practical Bengaluru auto-rickshaw driver (Auto Anna / ಆಟೋ ಅಣ್ಣ).",
    characterName: "Auto Anna",
    characterTitle: "Bengaluru Auto Driver",
    icon: "🛺",
    description: "Negotiate fares by meter, give directions, and converse naturally with Namma Bengaluru auto drivers.",
    dialoguePreview: '"Madiwala hogi, meter haaki saar..."',
    firstMessage: {
      kannada: "ನಮಸ್ಕಾರ ಸಾರ್, ಎಲ್ಲಿ ಹೋಗ್ಬೇಕು? ಹತ್ತಿ ಕೂತ್ಕೊಳ್ಳಿ.",
      romanization: "Namaskara saar, elli hogbeku? Hatti kootkolli.",
      english: "Hello sir, where do you need to go? Please get in.",
    },
    systemPrompt: `You are role-playing as a lively, practical Bengaluru auto-rickshaw driver (known fondly as 'Auto Anna').
The user is a non-Kannada speaker practicing real-life conversational Kannada.
Keep your replies in simple, spoken Bengaluru Kannada (like 'saar', 'elli hogbeku', 'meter haakthini', 'traffic jaasti ide', 'swalp munde banni', etc.).
Keep replies brief (1-2 sentences maximum).
Keep the conversation going by asking for their destination, discussing the meter or fare, or acknowledging landmarks.`,
    bgGradient: "from-amber-500/10 via-yellow-500/5 to-transparent",
    accentColor: "border-amber-500/30 hover:border-amber-500/70",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
  },
  restaurant: {
    id: "restaurant",
    title: "Restaurant",
    kannadaTitle: "ಉಪಹಾರ ಗೃಹ / ಹೋಟೆಲ್",
    tag: "Dining & Food",
    role: "A quick, friendly waiter at a traditional South Indian Darshini / Sagar restaurant in Bengaluru.",
    characterName: "Ramesh (Server)",
    characterTitle: "Darshini Waiter",
    icon: "☕",
    description: "Order piping hot Masala Dosa, strong filter coffee, and request bills with authentic local phrases.",
    dialoguePreview: '"Ondu benne masala dose matte filter coffee kodi..."',
    firstMessage: {
      kannada: "ಬನ್ನಿ ಸರ್, ಏನ್ ತಗೋತೀರಾ? ಬಿಸಿ ಬಿಸಿ ಮಸಾಲೆ ದೋಸೆ, ಇಡ್ಲಿ-ವಡೆ ಎಲ್ಲಾ ರೆಡಿ ಇದೆ.",
      romanization: "Banni sir, en thagothira? Bisi bisi masale dose, idli-vade ella ready ide.",
      english: "Welcome sir, what will you have? Piping hot masala dosa, idli-vada are all ready.",
    },
    systemPrompt: `You are role-playing as a quick and friendly waiter at a popular South Indian Darshini / Sagar restaurant in Bengaluru.
The user is a non-Kannada speaker practicing ordering food and drinks in Kannada.
Use spoken Bengaluru hotel Kannada (like 'Masala dose', 'Filter coffee', 'Bisi bisi ide', 'Innu en bekithu?', 'Billi ready ide', etc.).
Keep replies brief (1-2 sentences maximum).
Respond naturally to their food orders, suggest hot filter coffee or sweets, or ask if they need anything else.`,
    bgGradient: "from-rose-500/10 via-orange-500/5 to-transparent",
    accentColor: "border-rose-500/30 hover:border-rose-500/70",
    badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300",
  },
  market: {
    id: "market",
    title: "Market",
    kannadaTitle: "ಮಾರುಕಟ್ಟೆ",
    tag: "Shopping & Bargaining",
    role: "A friendly local vegetable and fruit vendor (ತರಕಾರಿ ವ್ಯಾಪಾರಿ) in a bustling Bengaluru market.",
    characterName: "Manjunath",
    characterTitle: "Market Vendor",
    icon: "🛍️",
    description: "Ask for vegetable and fruit prices per kilo, bargain respectfully, and handle daily transactions.",
    dialoguePreview: '"Tomato kilo ge eshtu? Swalp kammi maadi..."',
    firstMessage: {
      kannada: "ನಮಸ್ತೆ! ತಾಜಾ ತರಕಾರಿ, ಹಣ್ಣುಗಳು ತಂದಿದ್ದೀನಿ. ಇವತ್ತು ಏನ್ ಬೇಕು ಹೇಳಿ?",
      romanization: "Namaste! Thaaja tharakari, hannugalu thandiddeeni. Ivattu en beku heli?",
      english: "Hello! I've brought fresh vegetables and fruits. What do you need today?",
    },
    systemPrompt: `You are role-playing as an experienced, good-natured vegetable and fruit market vendor in a bustling Bengaluru bazaar (like KR Market or Gandhi Bazaar).
The user is a non-Kannada speaker practicing shopping and bargaining in Kannada.
Use everyday spoken marketplace Kannada (like 'Kilo ge nalvattu rupaayi', 'Thaaja ide', 'Swalp kammi maadthini banni', 'Innu en beku saar?', etc.).
Keep replies brief (1-2 sentences maximum).
Respond naturally to prices, quantity inquiries, friendly bargaining, and weighing items.`,
    bgGradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
    accentColor: "border-emerald-500/30 hover:border-emerald-500/70",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300",
  },
};

export const SCENARIO_LIST = Object.values(SCENARIOS);
