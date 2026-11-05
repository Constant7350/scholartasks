import type { ReactNode } from "react";

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <section className="s-pagehead">
      <div className="site-wrap">
        <p className="s-kicker">{kicker}</p>
        <h1>{title}</h1>
        {children && <p className="s-lede">{children}</p>}
      </div>
    </section>
  );
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="s-faq">
      {items.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function FinalCta({ title = "Start your family's plan today", text = "Free to start, no credit card. Set up takes a few minutes." }: { title?: string; text?: string }) {
  return (
    <section className="s-section navy">
      <div className="site-wrap s-center">
        <h2 className="s-title">{title}</h2>
        <p className="s-lede">{text}</p>
        <div className="s-cta" style={{ justifyContent: "center" }}>
          <a className="btn" href="/signin">Start free</a>
          <a className="btn btn-ghost" href="/contact">Ask us a question</a>
        </div>
      </div>
    </section>
  );
}
