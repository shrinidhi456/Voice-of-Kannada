export default function Home() {
  const scenarios = [
    {
      id: "auto-rickshaw",
      title: "Auto-rickshaw",
      kannadaTitle: "ಆಟೋ ರಿಕ್ಷಾ",
      tag: "Everyday Travel",
      description: "Negotiate fares by meter, give directions, and converse naturally with Namma Bengaluru auto drivers.",
      icon: "🛺",
      bgGradient: "from-amber-500/10 via-yellow-500/5 to-transparent",
      accentColor: "border-amber-500/30 hover:border-amber-500/70",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
      dialoguePreview: '"Madiwala hogi, meter haaki saar..."',
    },
    {
      id: "restaurant",
      title: "Restaurant",
      kannadaTitle: "ಉಪಹಾರ ಗೃಹ / ಹೋಟೆಲ್",
      tag: "Dining & Food",
      description: "Order piping hot Masala Dosa, strong filter coffee, and request bills with authentic local phrases.",
      icon: "☕",
      bgGradient: "from-rose-500/10 via-orange-500/5 to-transparent",
      accentColor: "border-rose-500/30 hover:border-rose-500/70",
      badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300",
      dialoguePreview: '"Ondu benne masala dose matte filter coffee kodi..."',
    },
    {
      id: "market",
      title: "Market",
      kannadaTitle: "ಮಾರುಕಟ್ಟೆ",
      tag: "Shopping & Bargaining",
      description: "Ask for vegetable and fruit prices per kilo, bargain respectfully, and handle daily transactions.",
      icon: "🛍️",
      bgGradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
      accentColor: "border-emerald-500/30 hover:border-emerald-500/70",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300",
      dialoguePreview: '"Tomato kilo ge eshtu? Swalp kammi maadi..."',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-amber-50/20 text-stone-900 dark:from-stone-950 dark:via-stone-900 dark:to-neutral-950 dark:text-stone-100 flex flex-col">
      {/* Header / Navbar */}
      <header className="border-b border-stone-200/60 dark:border-stone-800/80 backdrop-blur-md sticky top-0 z-50 bg-white/70 dark:bg-stone-950/70">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎙️</span>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-red-600 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                Voice of Kannada
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-500 ml-2 font-medium">
                ಕನ್ನಡದ ಧ್ವನಿ
              </span>
            </div>
          </div>
          <span className="text-xs px-3 py-1 rounded-full font-medium bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300/40">
            Hackathon MVP
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 md:py-16 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900/40 mb-5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            Speak Kannada with Confidence
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-5 leading-tight">
            Voice of Kannada
          </h1>
          <p className="text-lg sm:text-xl text-stone-600 dark:text-stone-300 leading-relaxed font-normal">
            Immersive voice-first role-play scenarios for non-Kannada speakers.
            Speak with an AI partner, hear authentic replies, and master pronunciation.
          </p>
        </div>

        {/* Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`group relative rounded-2xl border p-7 transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 flex flex-col justify-between bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm ${scenario.accentColor} bg-gradient-to-br ${scenario.bgGradient}`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-white dark:bg-stone-800 shadow-sm border border-stone-100 dark:border-stone-700/60 group-hover:scale-110 transition-transform">
                    {scenario.icon}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${scenario.badgeColor}`}>
                    {scenario.tag}
                  </span>
                </div>

                <div className="mb-3">
                  <h3 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
                    {scenario.title}
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 font-medium mt-0.5">
                    {scenario.kannadaTitle}
                  </p>
                </div>

                <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-5">
                  {scenario.description}
                </p>
              </div>

              <div>
                <div className="rounded-lg bg-stone-100/80 dark:bg-stone-800/60 p-3 mb-5 border border-stone-200/50 dark:border-stone-700/50">
                  <p className="text-[11px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-semibold mb-1">
                    Sample Phrase
                  </p>
                  <p className="text-xs italic text-stone-700 dark:text-stone-300 font-medium">
                    {scenario.dialoguePreview}
                  </p>
                </div>

                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-colors flex items-center justify-center gap-2 group-hover:shadow-md cursor-pointer"
                >
                  <span>Select Scenario</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200/60 dark:border-stone-800/80 py-6 text-center text-xs text-stone-500 dark:text-stone-400">
        <p>Voice of Kannada • Built for speaking practice and cultural connection</p>
      </footer>
    </div>
  );
}
