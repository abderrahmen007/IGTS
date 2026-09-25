'use client';

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestion des Entreprises</h2>
          <p className="text-sm text-slate-500 mt-1">Gérez les comptes clients et leurs accès.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Ajouter une entreprise
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Module en construction</h3>
        <p className="text-slate-500 max-w-md mx-auto">
          La liste complète des entreprises et l'édition de leurs profils sont en cours d'intégration depuis l'ancien système Symfony.
        </p>
      </div>
    </div>
  );
}
