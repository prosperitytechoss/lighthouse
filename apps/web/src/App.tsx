import { StickyCta } from "./components/StickyCta";
import { Cta } from "./sections/Cta";
import { Faq } from "./sections/Faq";
import { Features } from "./sections/Features";
import { Footer } from "./sections/Footer";
import { Hero } from "./sections/Hero";
import { HowItWorks } from "./sections/HowItWorks";
import { Nav } from "./sections/Nav";
import { PromiseBand } from "./sections/PromiseBand";
import { TrustBand } from "./sections/TrustBand";

export default function App() {
  return (
    <div id="top" className="min-h-screen bg-white pb-28 md:pb-0">
      <Nav />
      <main>
        <Hero />
        <TrustBand />
        <HowItWorks />
        <Features />
        <PromiseBand />
        <Faq />
        <Cta />
      </main>
      <Footer />
      <StickyCta />
    </div>
  );
}
