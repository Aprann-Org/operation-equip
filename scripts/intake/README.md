# Laptop intake script

`Invoke-EquipIntake.ps1` runs on a Windows laptop, reads its hardware, and fills
in that laptop's Operation Equip record through `POST /api/intake/autofill`.

## One-time setup

1. Apply the migration `supabase/migrations/20261114000000_intake_autofill.sql`.
2. Make sure the server has `SUPABASE_SERVICE_ROLE_KEY` set — the API uses it
   after checking the intake key.
3. As an org admin, open **Settings → Intake Keys** and create a key. Copy it —
   it is only shown once.
4. Copy this folder to a USB stick. Optionally copy
   `intake-config.example.json` to `intake-config.json` and fill in the URL
   and key so techs are not prompted (this file is gitignored — never commit it).

## Using it

1. Add the laptop in Operation Equip with its laptop number, as usual.
2. On the laptop, open PowerShell in the USB folder and run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\Invoke-EquipIntake.ps1
   ```

3. Enter the laptop number. The script shows what it read and what it will
   fill in, then asks you to confirm.

| Option         | What it does                                                        |
| -------------- | ------------------------------------------------------------------- |
| `-InternalId`  | Laptop number, instead of being prompted                            |
| `-DryRun`      | Show what would change, save nothing                                |
| `-Overwrite`   | Replace fields that already hold a different value                 |
| `-SkipBattery` | Don't generate a battery report                                     |
| `-Yes`         | Don't ask for confirmation                                          |
| `-ApiUrl`, `-ApiKey` | Override the URL / key (also `OPEQUIP_URL`, `OPEQUIP_API_KEY`) |

## What it fills in

Make, model, processor, RAM, disk capacity and type (SSD / HDD / NVMe), screen
size, Windows version, BIOS version and date, serial number, hardware UUID,
and a battery report (design and full-charge capacity, cycle count, estimated
runtime) from `powercfg /batteryreport`.

Windows and Office product keys are **not** collected.

## Rules

- **The laptop must already exist.** An unknown laptop number is rejected.
- **The first scan links the serial number and hardware UUID** to the record.
  After that, if the laptop number typed doesn't match this laptop's serial,
  the request is rejected instead of writing to the wrong record. If the
  serial is already registered to a different laptop number, the error says
  which one.
- **Only blank fields are filled.** Fields that already hold a different value
  are reported as conflicts and left alone unless `-Overwrite` is used.
  Serial number and hardware UUID are never overwritten — an org admin changes
  them on the device page (e.g. after a motherboard swap).
- Every change is recorded in the device's hardware change history with the
  reason `Auto-filled by intake script (key "<label>")`.
- Running the script twice in a day doesn't add a duplicate battery report.
