import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WizardStepper } from "./WizardStepper";
import { PoolSelectStep } from "./PoolSelectStep";
import { FeatureToggles } from "./FeatureToggles";
import { DecisionStep } from "./DecisionStep";
import { ExecuteStep } from "./ExecuteStep";
import { ApiModal } from "./ApiModal";
import { useWizardState } from "@/hooks/useWizardState";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

const STEPS = [
  { title: "Pool", description: "Configure pool" },
  { title: "Logic", description: "Configure features" },
  { title: "Decision", description: "Choose deployment" },
  { title: "Execute", description: "Deploy hook" },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export function HookWizard() {
  const {
    state,
    setPoolConfig,
    setFlags,
    setAgentPrompt,
    nextStep,
    prevStep,
    goToStep,
    selectDeployChoice,
    startMining,
    reset,
    canProceed,
    getGasEstimate,
  } = useWizardState();

  useEffect(() => {
    console.log("Wizard state", state);
  }, [state]);

  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    setDirection(1);
    nextStep();
  };

  const handlePrev = () => {
    setDirection(-1);
    prevStep();
  };

  const handleStepClick = (step: number) => {
    setDirection(step > state.currentStep ? 1 : -1);
    goToStep(step);
  };

  const renderStepContent = () => {
    switch (state.currentStep) {
      case 0:
        return (
          <PoolSelectStep config={state.poolConfig} onChange={setPoolConfig} />
        );
      case 1:
        return (
          <FeatureToggles
            flags={state.flags}
            onFlagsChange={setFlags}
            agentPrompt={state.agentPrompt}
            onAgentPromptChange={setAgentPrompt}
          />
        );
      case 2:
        return (
          <DecisionStep
            auditedHook={state.auditedHook}
            deployChoice={state.deployChoice}
            onSelectChoice={selectDeployChoice}
            gasEstimates={getGasEstimate()}
            isMining={state.isMining}
            create2Salt={state.create2Salt}
            onStartMining={startMining}
          />
        );
      case 3:
        return (
          <ExecuteStep
            tokenInputs={{
              tokenA: state.poolConfig.tokenAInput,
              tokenB: state.poolConfig.tokenBInput,
              chainId: state.poolConfig.chainId,
              tokenAAddress: state.poolConfig.tokenAAddress,
              tokenBAddress: state.poolConfig.tokenBAddress,
            }}
            flags={state.flags}
            agentPrompt={state.agentPrompt}
            feeTier={state.poolConfig.feeTier}
            deployChoice={state.deployChoice}
            auditedHook={state.auditedHook}
            deployedAddress={state.deployedAddress}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Stepper */}
        <WizardStepper
          steps={STEPS}
          currentStep={state.currentStep}
          onStepClick={handleStepClick}
        />

        {/* Content Card */}
        <Card className="border-border/50 overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="text-xl">
              Step {state.currentStep + 1}: {STEPS[state.currentStep].title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 min-h-[450px]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={state.currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={state.currentStep === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>

          <Button
            variant="ghost"
            onClick={reset}
            className="text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>

          {state.currentStep < STEPS.length - 1 && (
            <Button
              onClick={handleNext}
              disabled={!canProceed(state.currentStep)}
              className="gap-2 gradient-brand text-white hover:opacity-90"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}

          {state.currentStep === STEPS.length - 1 && (
            <div className="w-[88px]" />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center pt-4 border-t border-border/30">
          <ApiModal />
        </div>
      </div>
    </div>
  );
}
