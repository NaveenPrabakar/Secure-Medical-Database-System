use Hospitals;

CREATE INDEX idx_patientconditions_patient_id 
ON PatientConditions(patient_id);

CREATE INDEX idx_patientconditions_condition_id 
ON PatientConditions(condition_id);

CREATE INDEX idx_vitals_patient_id 
ON Vitals(patient_id);

CREATE INDEX idx_labresults_patient_id 
ON LabResults(patient_id);

CREATE INDEX idx_lifestyle_patient_id 
ON Lifestyle(patient_id);

CREATE INDEX idx_hospitalization_patient_id 
ON Hospitalization(patient_id);

CREATE INDEX idx_familyhistory_patient_id 
ON FamilyHistory(patient_id);