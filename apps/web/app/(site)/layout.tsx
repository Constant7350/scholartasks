import type { ReactNode } from "react";
import "./site.css";
import { BrandMark } from "../brand";
import { SUPPORT_EMAIL } from "../legal";
import { SiteHeader } from "./site-header";

/** Layout for the public website pages (home, features, compare, schools, about, contact). */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <SiteHeader />
      <main>{children}</main>
      <footer className="site-foot">
        <div className="site-wrap">
          <div className="site-foot-grid">
            <div>
              <a className="brand" href="/"><BrandMark /><span>ScholarTasks</span></a>
              <p>College, scholarships, Georgia aid, grades and test prep for families, from 6th grade to graduation.</p>
            </div>
            <div>
              <h4>Learn more</h4>
              <ul>
                <li><a href="/features">Features</a></li>
                <li><a href="/#how">How it works</a></li>
                <li><a href="/compare">Compare apps</a></li>
                <li><a href="/schools">For schools</a></li>
              </ul>
            </div>
            <div>
              <h4>Try it</h4>
              <ul>
                <li><a href="/signin">Start free</a></li>
                <li><a href="/tools/hope">State scholarship checker</a></li>
                <li><a href="/trades">Explore the trades</a></li>
                <li><a href="/trades/post">For employers: post an apprenticeship</a></li>
                <li><a href="/employers">For employers: hire students for weekend jobs</a></li>
                <li><a href="/help">Help guide</a></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><a href="/about">About us</a></li>
                <li><a href="/contact">Contact us</a></li>
                <li><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
              </ul>
            </div>
          </div>
          <div className="site-foot-base">
            <span>© {new Date().getFullYear()} ScholarTasks · Made in Georgia</span>
            <span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/delete-account">Delete account</a> · <a href="/accessibility">Accessibility</a></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
