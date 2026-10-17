export interface ScenarioMessage {
  kannada: string;
  romanization: string;
  english: string;
}

export interface PracticePhrase {
  id: string;
  kannada: string;
  romanization: string;
  english: string;
  tipContext?: string;
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
  practicePhrases: PracticePhrase[];
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
    practicePhrases: [
      {
        id: "auto-1",
        kannada: "ಮೀಟರ್ ಹಾಕಿ ಸಾರ್",
        romanization: "Meter haaki saar",
        english: "Please put on the meter, sir",
      },
      {
        id: "auto-2",
        kannada: "ಮಡಿವಾಳಕ್ಕೆ ಎಷ್ಟು ಆಗುತ್ತೆ?",
        romanization: "Madiwalakke eshtu aagutthe?",
        english: "How much will it be to Madiwala?",
      },
      {
        id: "auto-3",
        kannada: "ಇಲ್ಲಿ ಸ್ವಲ್ಪ ಮುಂದೆ ನಿಲ್ಲಿಸಿ",
        romanization: "Illi swalp munde nillisi",
        english: "Please stop a little ahead here",
      },
      {
        id: "auto-4",
        kannada: "ಮುಂದೆ ಬಲಗಡೆ ತಗೊಳ್ಳಿ",
        romanization: "Munde bala gade thagolli",
        english: "Take a right turn ahead",
      },
      {
        id: "auto-5",
        kannada: "ಚಿಲ್ಲರೆ ಇದೆಯಾ ಸಾರ್?",
        romanization: "Chillare ideya saar?",
        english: "Do you have change, sir?",
      },
      {
        id: "auto-6",
        kannada: "ಮೆಟ್ರೋ ಸ್ಟೇಷನ್ ಹತ್ತಿರ ಹೋಗಿ",
        romanization: "Metro station hathira hogi",
        english: "Please go near the metro station",
      },
    ],
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
    practicePhrases: [
      {
        id: "rest-1",
        kannada: "ಒಂದು ಮಸಾಲೆ ದೋಸೆ ಕೊಡಿ",
        romanization: "Ondu masale dose kodi",
        english: "Please give one masala dosa",
      },
      {
        id: "rest-2",
        kannada: "ನೀರು ಬೇಕು",
        romanization: "Neeru beku",
        english: "I need water",
      },
      {
        id: "rest-3",
        kannada: "ಬಿಲ್ ಕೊಡಿ",
        romanization: "Bill kodi",
        english: "Please give the bill",
      },
      {
        id: "rest-4",
        kannada: "ಒಂದು ಸ್ಟ್ರಾಂಗ್ ಫಿಲ್ಟರ್ ಕಾಫಿ",
        romanization: "Ondu strong filter coffee",
        english: "One strong filter coffee",
      },
      {
        id: "rest-5",
        kannada: "ಚಟ್ನಿ ಸ್ವಲ್ಪ ಜಾಸ್ತಿ ಕೊಡಿ",
        romanization: "Chutney swalp jaasthi kodi",
        english: "Please give a little extra chutney",
      },
      {
        id: "rest-6",
        kannada: "ಖಾರ ಸ್ವಲ್ಪ ಕಮ್ಮಿ ಮಾಡಿ",
        romanization: "Khaara swalp kammi maadi",
        english: "Please make it less spicy",
      },
    ],
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
    practicePhrases: [
      {
        id: "mkt-1",
        kannada: "ಟೊಮೆಟೊ ಕಿಲೋಗೆ ಎಷ್ಟು?",
        romanization: "Tomato kiloge eshtu?",
        english: "How much per kilo of tomatoes?",
      },
      {
        id: "mkt-2",
        kannada: "ಸ್ವಲ್ಪ ಕಮ್ಮಿ ಮಾಡಿ ಕೊಡಿ",
        romanization: "Swalp kammi maadi kodi",
        english: "Please reduce the price a little",
      },
      {
        id: "mkt-3",
        kannada: "ತಾಜಾ ಹಣ್ಣುಗಳು ಇದೆಯಾ?",
        romanization: "Thaaja hannugalu ideya?",
        english: "Are these fruits fresh?",
      },
      {
        id: "mkt-4",
        kannada: "ಅರ್ಧ ಕಿಲೋ ಕೊಡಿ",
        romanization: "Ardha kilo kodi",
        english: "Please give half a kilo",
      },
      {
        id: "mkt-5",
        kannada: "ಒಟ್ಟು ಎಷ್ಟು ಆಯ್ತು?",
        romanization: "Ottu eshtu aaythu?",
        english: "How much is the total?",
      },
      {
        id: "mkt-6",
        kannada: "ಒಂದು ಬ್ಯಾಗ್ ಕೊಡಿ",
        romanization: "Ondu bag kodi",
        english: "Please give me a carry bag",
      },
    ],
  },
};

export const SCENARIO_LIST = Object.values(SCENARIOS);
