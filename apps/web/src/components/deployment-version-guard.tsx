'use client';

import { useEffect } from 'react';

const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? '';

export function DeploymentVersionGuard() {
  useEffect(() => {
    if (!BUILD_SHA || typeof window === 'undefined') return;

    const basePath = window.location.pathname.startsWith('/accounting-platform') ? '/accounting-platform' : '';
    const versionUrl = `${basePath}/version.json?ts=${Date.now()}`;

    fetch(versionUrl, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { sha?: string } | null) => {
        const deployedSha = payload?.sha?.trim();
        if (!deployedSha || deployedSha === BUILD_SHA) return;

        const reloadKey = `accounting.deployment-reload.${deployedSha}`;
        if (window.sessionStorage.getItem(reloadKey)) return;
        window.sessionStorage.setItem(reloadKey, '1');

        const url = new URL(window.location.href);
        url.searchParams.set('__v', deployedSha.slice(0, 12));
        window.location.replace(url.toString());
      })
      .catch(() => {
        // A version check must never interrupt accounting work.
      });
  }, []);

  return null;
}
