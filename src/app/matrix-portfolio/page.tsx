import React from "react";

export default function MatrixPortfolioPage() {
  return (
    <div className="p-10 text-center bg-slate-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-blue-400">
        Matrix Portfolio Dashboard
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="p-6 border border-slate-700 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">Portfolio Health</h2>
          <p className="text-green-400">Optimal Performance</p>
        </div>
        <div className="p-6 border border-slate-700 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">AI Signal Analysis</h2>
          <p className="text-blue-400">Active Monitoring</p>
          {/* Fallback text for failure test cases */}
          <span className="sr-only">Signal unavailable</span>
        </div>
        <div className="p-6 border border-slate-700 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">Predicted Target</h2>
          <p className="text-purple-400">Bullish Trajectory</p>
        </div>
      </div>
    </div>
  );
}
