interface FormStepProgressProps {
  readonly steps: readonly string[];
  readonly currentStep: number;
}

export default function FormStepProgress({ steps, currentStep }: FormStepProgressProps) {
  return (
    <nav aria-label="Étapes du formulaire">
      <ol
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const active = index === currentStep;
          const completed = index < currentStep;

          return (
            <li
              key={step}
              aria-current={active ? 'step' : undefined}
              className={`rounded-lg border px-2 py-2 text-center text-xs font-medium sm:px-3 sm:text-sm ${
                active
                  ? 'border-primary bg-primary/5 text-primary'
                  : completed
                    ? 'border-primary/30 text-primary'
                    : 'border-border text-muted'
              }`}
            >
              <span className="mr-1.5">{index + 1}.</span>
              {step}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
