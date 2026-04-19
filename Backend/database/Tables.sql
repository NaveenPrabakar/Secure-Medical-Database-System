use Hospitals;

CREATE TABLE Patients (
    patient_id SERIAL PRIMARY KEY,
    age VARCHAR(512),
    gender VARCHAR(512)
);


CREATE TABLE MedicalConditions (
    condition_id SERIAL PRIMARY KEY,
    condition_name VARCHAR(512) UNIQUE
);

CREATE TABLE PatientConditions (
    patient_id INT REFERENCES Patients(patient_id),
    condition_id INT REFERENCES MedicalConditions(condition_id),
    PRIMARY KEY (patient_id, condition_id)
);

CREATE TABLE Vitals (
    vitals_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES Patients(patient_id),
    glucose VARCHAR(512),
    blood_pressure VARCHAR(512),
    bmi VARCHAR(512),
    oxygen_saturation VARCHAR(512)
);

CREATE TABLE LabResults (
    lab_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES Patients(patient_id),
    cholesterol VARCHAR(512),
    triglycerides VARCHAR(512),
    hba1c VARCHAR(512)
);

CREATE TABLE Lifestyle (
    lifestyle_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES Patients(patient_id),
    smoking VARCHAR(512),
    alcohol VARCHAR(512),
    physical_activity VARCHAR(512),
    diet_score VARCHAR(512),
    sleep_hours VARCHAR(512),
    stress_level VARCHAR(512)
);

CREATE TABLE Hospitalization (
    hospitalization_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES Patients(patient_id),
    length_of_stay VARCHAR(512)
);

CREATE TABLE FamilyHistory (
    history_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES Patients(patient_id),
    has_family_history VARCHAR(512)
);

