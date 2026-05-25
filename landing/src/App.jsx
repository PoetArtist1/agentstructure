import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Architecture from './components/Architecture'
import InstallSection from './components/InstallSection'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      {/* Animated background */}
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow bg-glow--1" aria-hidden="true" />
      <div className="bg-glow bg-glow--2" aria-hidden="true" />
      <div className="bg-glow bg-glow--3" aria-hidden="true" />

      {/* Page sections */}
      <Navbar />
      <Hero />
      <Features />
      <Architecture />
      <InstallSection />
      <Footer />
    </>
  )
}
