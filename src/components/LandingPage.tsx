import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Zap,
  Code,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Audited Hooks",
    description:
      "Choose from battle-tested, security-audited hook implementations",
  },
  {
    icon: Zap,
    title: "Gas Optimized",
    description:
      "Deploy efficient hooks with CREATE2 address mining for optimal gas costs",
  },
  {
    icon: Code,
    title: "Custom Logic",
    description: "Natural language Agent Mode for custom hook generation",
  },
  {
    icon: Layers,
    title: "On-chain Registry",
    description:
      "Blockchain-native configuration with verifiable hook registry",
  },
];

const steps = [
  "Select your token pair",
  "Configure hook logic",
  "Choose deployment path",
  "Execute transaction",
];

export function LandingPage() {
  const baseUrl = import.meta.env.BASE_URL;
  return (
    <div className="min-h-screen pt-16 uniswap-hero">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <img src={`${baseUrl}logo.svg`} alt="HookWizard" className="w-5 h-5" />
              <span className="text-sm font-medium text-primary">
                Uniswap v4 Ready
              </span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-semibold tracking-tight mb-6">
              Deploy Custom Hooks{" "}
              <span className="gradient-brand-text">in Minutes</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              The visual wizard for deploying Uniswap v4 hooks. Choose audited
              implementations or create custom logic with our AI-powered Agent
              Mode.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link to="/wizard">
                <Button
                  size="lg"
                  className="gradient-brand text-white glow-primary group px-8"
                >
                  Start Building
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button size="lg" variant="outline">
                View Documentation
              </Button>
            </motion.div>
          </motion.div>

          {/* Floating Steps Preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-20 max-w-3xl mx-auto"
          >
            <div className="surface-card p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                {steps.map((step, index) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center text-white text-sm font-semibold">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium hidden sm:block">
                      {step}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built for developers who want to deploy production-ready hooks
              without the complexity
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="surface-card p-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Deploy?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join the next generation of DeFi developers using HookWizard to
              deploy secure, efficient Uniswap v4 hooks.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              {["No coding required", "Security audited", "Gas optimized"].map(
                (item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>{item}</span>
                  </div>
                ),
              )}
            </div>

            <Link to="/wizard">
              <Button
                size="lg"
                className="gradient-brand text-white glow-primary"
              >
                Launch Wizard
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built for Uniswap v4 · Open Source</p>
        </div>
      </footer>
    </div>
  );
}
