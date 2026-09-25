'use client';

import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        try {
          const res = await fetch(`http://localhost:3001/api/dashboard/${parsedUser.type}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          
          if (res.ok) {
            const data = await res.json();
            setStats(data);
          }
        } catch (error) {
          console.error('Failed to fetch dashboard stats', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // ---------- ADMIN DASHBOARD VIEW ----------
  if (user?.type === 'admin') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Vue d'ensemble Administrateur</h2>
        
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Entreprises Actives</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats?.stats?.totalCompanies || 0}</h3>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Textes de Loi</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats?.stats?.totalTexts || 0}</h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Scrapers Actifs</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats?.stats?.activeScrapers || 0}</h3>
            </div>
          </div>
        </div>

        {/* Recent Companies */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-8">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Dernières entreprises inscrites</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">Voir tout</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Nom de l'entreprise</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Date de création</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats?.recentCompanies?.map((company: any) => (
                  <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{company.nom}</td>
                    <td className="px-6 py-4 text-slate-600">{company.email}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(company.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Gérer</button>
                    </td>
                  </tr>
                ))}
                {(!stats?.recentCompanies || stats.recentCompanies.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      Aucune entreprise trouvée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ---------- COMPANY DASHBOARD VIEW ----------
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Votre Veille Réglementaire</h2>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <svg className="w-24 h-24 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1 relative z-10">Total des textes applicables</p>
          <h3 className="text-4xl font-extrabold text-slate-800 relative z-10">{stats?.stats?.totalTexts || 0}</h3>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-md text-white relative overflow-hidden group">
          <p className="text-sm font-medium text-green-100 mb-1 relative z-10">Taux de conformité</p>
          <div className="flex items-baseline gap-2 relative z-10">
            <h3 className="text-4xl font-extrabold">
              {stats?.stats?.totalTexts > 0 
                ? Math.round((stats.stats.compliantTexts / stats.stats.totalTexts) * 100) 
                : 0}%
            </h3>
            <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">+2% ce mois</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
          <p className="text-sm font-medium text-slate-500 mb-1 relative z-10">Actions en attente</p>
          <h3 className="text-4xl font-extrabold text-orange-500 relative z-10">{stats?.stats?.pendingActions || 0}</h3>
          <p className="text-xs text-slate-400 mt-2">Nécessite votre attention</p>
        </div>
      </div>

      {/* Recent Texts list */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Nouveaux textes parus</h3>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">Voir tous mes textes</button>
        </div>
        <div className="divide-y divide-slate-100">
          {stats?.recentTexts?.map((texte: any) => (
            <div key={texte.id} className="p-6 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex-shrink-0 flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <h4 className="font-medium text-slate-800 leading-tight">{texte.name}</h4>
                  <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">Nouveau</span>
                </div>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{texte.ntext}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    {texte.datetext ? new Date(texte.datetext).toLocaleDateString('fr-FR') : 'Non daté'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {(!stats?.recentTexts || stats.recentTexts.length === 0) && (
            <div className="p-8 text-center text-slate-500">
              Aucun nouveau texte à afficher.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
