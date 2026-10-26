CREATE TABLE IF NOT EXISTS lb_calibrations (
  methodology_version text NOT NULL,
  unit                text NOT NULL,
  protocol            text NOT NULL,
  calibration         jsonb NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (methodology_version, unit, protocol)
);
