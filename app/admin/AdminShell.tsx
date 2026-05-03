'use client';

import type { ReactNode } from 'react';

type AdminShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export default function AdminShell({
  title,
  description,
  children,
}: AdminShellProps) {
  return (
    <main className="admin-shell-root">
      <div className="admin-shell-inner">
        <header className="admin-shell-header">
          <h1 className="admin-shell-title">{title}</h1>
          {description ? (
            <p className="admin-shell-description">{description}</p>
          ) : null}
        </header>

        <section className="admin-shell-content">{children}</section>
      </div>

      <style jsx>{`
        .admin-shell-root {
          min-height: 100vh;
          background: #f8fafc;
          padding: 28px 24px 40px;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .admin-shell-inner {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .admin-shell-header {
          margin-bottom: 24px;
        }

        .admin-shell-title {
          margin: 0;
          color: #0f172a;
          font-size: 42px;
          line-height: 1.2;
          letter-spacing: -0.03em;
          word-break: keep-all;
          overflow-wrap: break-word;
          white-space: normal;
        }

        .admin-shell-description {
          margin: 12px 0 0;
          color: #64748b;
          font-size: 18px;
          line-height: 1.7;
          word-break: keep-all;
          overflow-wrap: break-word;
          white-space: normal;
        }

        .admin-shell-content {
          width: 100%;
          min-width: 0;
          overflow-x: hidden;
        }

        .admin-shell-content :global(*) {
          box-sizing: border-box;
          min-width: 0;
          max-width: 100%;
          writing-mode: horizontal-tb !important;
          word-break: keep-all;
          overflow-wrap: break-word;
          white-space: normal;
        }

        .admin-shell-content :global(img),
        .admin-shell-content :global(video),
        .admin-shell-content :global(canvas),
        .admin-shell-content :global(svg),
        .admin-shell-content :global(table),
        .admin-shell-content :global(select),
        .admin-shell-content :global(input),
        .admin-shell-content :global(textarea),
        .admin-shell-content :global(button) {
          max-width: 100%;
        }

        .admin-shell-content :global(textarea) {
          width: 100%;
        }

        .admin-shell-content :global(input),
        .admin-shell-content :global(textarea) {
          color: #111827;
          caret-color: #111827;
        }

        .admin-shell-content :global(input::placeholder),
        .admin-shell-content :global(textarea::placeholder) {
          color: #64748b;
          opacity: 1;
        }

        @media (max-width: 768px) {
          .admin-shell-root {
            padding: 16px 12px 28px;
          }

          .admin-shell-header {
            margin-bottom: 18px;
          }

          .admin-shell-title {
            font-size: 28px;
            line-height: 1.25;
          }

          .admin-shell-description {
            margin-top: 10px;
            font-size: 16px;
            line-height: 1.6;
          }

          .admin-shell-content {
            width: 100%;
            min-width: 0;
          }

          .admin-shell-content :global(section),
          .admin-shell-content :global(article),
          .admin-shell-content :global(form),
          .admin-shell-content :global(div) {
            min-width: 0;
          }

          .admin-shell-content :global(input),
          .admin-shell-content :global(select),
          .admin-shell-content :global(textarea),
          .admin-shell-content :global(button) {
            font-size: 16px;
          }
        }
      `}</style>
      <style jsx global>{`
        .admin-shell-content input,
        .admin-shell-content textarea,
        .admin-shell-content select {
          color: #111827 !important;
          caret-color: #111827;
        }

        .admin-shell-content input::placeholder,
        .admin-shell-content textarea::placeholder {
          color: #475569 !important;
          opacity: 1;
        }
      `}</style>
    </main>
  );
}
