import React from 'react';
import { Link } from 'react-router-dom';
import { Mic2, Tv, Smartphone, Music, ListMusic, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import NeonText from '@/components/karaoke/NeonText';

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary))_52%,#03050a_100%)]" />
        <div className="absolute inset-0 opacity-[0.12] bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:56px_56px]" />
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center relative z-10 max-w-lg"
      >
        {/* Logo */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="mb-8"
        >
          <Mic2 className="w-20 h-20 text-primary mx-auto mb-4" />
        </motion.div>

        <NeonText color="purple" as="h1" className="text-5xl md:text-7xl font-orbitron font-black block mb-3">
          VIBEOKE
        </NeonText>
        <p className="text-muted-foreground text-lg mb-12">
          Fast karaoke reservations with a shared realtime queue and searchable music library
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          <Link to="/player">
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="p-6 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all glow-border-purple cursor-pointer"
            >
              <Tv className="w-10 h-10 text-primary mb-3 mx-auto" />
              <h3 className="font-orbitron font-bold text-lg mb-1">Player Screen</h3>
              <p className="text-sm text-muted-foreground">
                Open on your TV or main display
              </p>
            </motion.div>
          </Link>

          <Link to="/controller">
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="p-6 rounded-xl bg-card border border-border/50 hover:border-accent/30 transition-all glow-border-blue cursor-pointer"
            >
              <Smartphone className="w-10 h-10 text-accent mb-3 mx-auto" />
              <h3 className="font-orbitron font-bold text-lg mb-1">Controller</h3>
              <p className="text-sm text-muted-foreground">
                Remote control from any device
              </p>
            </motion.div>
          </Link>
        </div>

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { icon: Music, label: 'Music Library' },
            { icon: ListMusic, label: 'Shared Queue' },
            { icon: Zap, label: 'Realtime Sync' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/30 px-3 py-1.5 rounded-full">
              <Icon className="w-3 h-3 text-primary" />
              {label}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
