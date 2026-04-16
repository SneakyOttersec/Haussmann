export function cashFlowMensuel(
  loyerMensuel: number,
  mensualiteCredit: number,
  chargesMensuelles: number
): number {
  return loyerMensuel - mensualiteCredit - chargesMensuelles;
}

export function cashFlowAnnuel(
  loyerAnnuel: number,
  mensualitesAnnuelles: number,
  chargesAnnuelles: number
): number {
  return loyerAnnuel - mensualitesAnnuelles - chargesAnnuelles;
}
