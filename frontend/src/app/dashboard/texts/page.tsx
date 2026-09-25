'use client';

export default function AdminTextsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Base de Données des Textes</h2>
          <p className="text-sm text-slate-500 mt-1">Supervisez tous les textes juridiques et leur affectation.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Saisie Manuelle
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Module en construction</h3>
        <p className="text-slate-500 max-w-md mx-auto">
          L'interface d'administration avancée des textes (qui complétera le Scraper IA) est en cours de portage.
        </p>
      </div>
    </div>
  );
}
