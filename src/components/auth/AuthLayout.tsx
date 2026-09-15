import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Activity, ShieldCheck, Heart, Stethoscope, Pill, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthLayoutProps {
  children: ReactNode;
  showBranding?: boolean;
}

const floatingShapes = [
  { icon: Heart, delay: 0, x: 15, y: 20, size: 'h-5 w-5' },
  { icon: Stethoscope, delay: 0.5, x: 75, y: 35, size: 'h-6 w-6' },
  { icon: Pill, delay: 1, x: 25, y: 70, size: 'h-4 w-4' },
  { icon: ClipboardList, delay: 1.5, x: 80, y: 75, size: 'h-5 w-5' },
];

const features = [
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    description: 'HIPAA compliant encryption with role-based access control.',
  },
  {
    icon: Activity,
    title: 'Real-time Monitoring',
    description: 'Live patient vitals and automated clinical workflows.',
  },
];

export default function AuthLayout({ children, showBranding = true }: AuthLayoutProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen flex w-full bg-background" id="auth-layout">
      {/* Left Side: Form Panel */}
      <div
        className={cn(
          'flex-1 flex flex-col justify-center items-center lg:items-stretch px-4 xs:px-6 sm:px-8 lg:px-12 lg:flex-none lg:w-[480px] xl:w-[560px] 2xl:w-[640px] z-10 bg-background relative',
          !showBranding && 'lg:mx-auto'
        )}
      >
        <div className="w-full max-w-[340px] xs:max-w-sm sm:max-w-md mx-auto my-auto lg:my-0">
          {children}
        </div>
      </div>

      {/* Right Side: Branding Panel */}
      {showBranding && (
        <div className="auth-branding-panel flex-1 flex-col justify-between bg-primary px-12 py-16 text-primary-foreground overflow-hidden relative">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {floatingShapes.map((shape, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{ left: `${shape.x}%`, top: `${shape.y}%` }}
                initial={reduceMotion ? false : { opacity: 0, scale: 0 }}
                animate={
                  reduceMotion
                    ? { opacity: 0.15, scale: 1 }
                    : {
                        opacity: [0, 0.15, 0.15, 0],
                        scale: [0.8, 1, 1, 0.8],
                        y: [0, -10, -10, 0],
                      }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 8,
                        repeat: Infinity,
                        delay: shape.delay,
                        ease: 'easeInOut',
                      }
                }
              >
                <shape.icon className={shape.size} style={{ color: 'var(--primary-foreground)' }} />
              </motion.div>
            ))}

            {/* Decorative circles */}
            <motion.div
              className="absolute right-16 top-16 h-64 w-64 rounded-full border border-primary-foreground/10"
              animate={reduceMotion ? false : { rotate: 360 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 60, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute bottom-24 left-24 h-96 w-96 rounded-full border border-primary-foreground/5"
              animate={reduceMotion ? false : { rotate: -360 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 80, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-2xl mt-12">
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-semibold mb-8 border border-emerald-500/30"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              System Operational
            </motion.div>

            <motion.h2
              className="text-4xl xl:text-5xl font-bold tracking-tight mb-6 leading-[1.15]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Secure, intelligent healthcare management.
            </motion.h2>

            <motion.p
              className="text-lg text-primary-foreground/70 leading-relaxed max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              A comprehensive clinical platform combining electronic health records, pharmacy workflows, and automated scheduling into one unified system.
            </motion.p>
          </div>

          <div className="relative z-10 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-12 border-t border-primary-foreground/15">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  className="flex gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                >
                  <div className="h-10 w-10 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="h-5 w-5 text-primary-foreground/80" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary-foreground">{feature.title}</h3>
                    <p className="text-sm text-primary-foreground/70 mt-1">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="flex items-center gap-2 text-sm text-primary-foreground/60 mt-16 font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <span>&copy; 2026 Smart Health Systems</span>
              <span>&middot;</span>
              <Link to="/super-admin/login" className="hover:text-primary-foreground transition-colors flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Super Admin Access
              </Link>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
