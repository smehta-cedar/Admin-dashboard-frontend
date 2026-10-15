import type { Metadata } from "next";
import { ReadyCta, SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Our Team | Cedar Grove Senior Health Solutions",
  description:
    "Meet the owners and licensed independent Medicare agents of Cedar Grove Senior Health Solutions in Covington, Louisiana.",
};

const OWNERS = [
  { name: "Michael Wahl", photo: "/assets/team/MW.png", lead: false },
  { name: "Luke Ordogne", photo: "/assets/team/LO.png", lead: true },
  { name: "John Montelepre", photo: "/assets/team/JM.jpeg", lead: false },
] as const;

const AGENTS = [
  { name: "Doug McRae", photo: "/assets/team/DM.png" },
  { name: "Brandon Wahl", photo: "/assets/team/BW.jpg" },
  { name: "Daniel Wanner", photo: "/assets/team/DJ.png" },
  { name: "Joey Carbo", photo: "/assets/team/JC.png" },
  { name: "Robert Flatt", photo: "/assets/team/RF.png" },
  { name: "Austin Scott", photo: "/assets/team/AS.jpg" },
  { name: "Scott Poulin", photo: "/assets/team/SP.jpg" },
  { name: "Raymond Billings", photo: "/assets/team/RB.jpg" },
  { name: "Matthew Tillman", photo: "/assets/team/MT.jpg" },
] as const;

export default function TeamPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <SiteHeader current="team" />
      <main id="main">
        <section className="s-page-banner" aria-labelledby="team-heading">
          <div className="container max-w-8xl mx-auto px-2">
            <h1 id="team-heading" className="page-banner__heading text-teal">
              Meet Our Team
            </h1>
          </div>
        </section>

        <section id="owners" className="s-team px-4" aria-labelledby="owners-heading">
          <div className="container max-w-8xl mx-auto px-4">
            <h2 id="owners-heading" className="visually-hidden">
              Owners
            </h2>
            <div className="team__owners">
              {OWNERS.map((person) => (
                <article
                  key={person.name}
                  className={`team-card team-card--owner${person.lead ? " team-card--lead" : ""}`}
                >
                  <div className="team-card__photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={person.photo}
                      alt={person.name}
                      loading="lazy"
                      width={400}
                      height={500}
                    />
                  </div>
                  <div className="team-card__body">
                    <h3 className="team-card__name">{person.name}</h3>
                    <p className="team-card__role">Owner</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="agents" className="s-team s-team--alt" aria-labelledby="agents-heading">
          <div className="container max-w-8xl mx-auto px-4">
            <header className="section-header section-header--light">
              <h2 id="agents-heading" className="section-heading section-heading--light">
                Our Agents
              </h2>
              <p className="section-sub section-sub--light">The People Behind Your Coverage</p>
            </header>

            <div className="team__agents">
              {AGENTS.map((person) => (
                <article key={person.name} className="team-card">
                  <div className="team-card__photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={person.photo}
                      alt={person.name}
                      loading="lazy"
                      width={400}
                      height={500}
                    />
                  </div>
                  <div className="team-card__body">
                    <h3 className="team-card__name">{person.name}</h3>
                    <p className="team-card__role">Licensed Agent</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <ReadyCta />
      <SiteFooter />
    </>
  );
}
