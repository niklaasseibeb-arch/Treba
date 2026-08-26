import React, { useState } from "react";

import { base44 } from "@/api/base44Client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import {
  Loader2,
  Upload,
  Plus,
  X,
  Car,
  Route as RouteIcon,
  User as UserIcon,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";
import { NAMIBIAN_TOWNS } from "@/lib/treba-places";


const VEHICLE_TYPES = [
  {
    value: "sedan",
    label: "Sedan",
  },
  {
    value: "suv",
    label: "SUV",
  },
  {
    value: "minibus",
    label: "Minibus",
  },
  {
    value: "van",
    label: "Van",
  },
  {
    value: "bus",
    label: "Bus",
  },
];


const STEPS = [
  {
    key: "personal",
    label: "Personal",
    icon: UserIcon,
  },
  {
    key: "driver",
    label: "Driver",
    icon: ShieldCheck,
  },
  {
    key: "vehicle",
    label: "Vehicle",
    icon: Car,
  },
  {
    key: "routes",
    label: "Routes",
    icon: RouteIcon,
  },
];


export default function DriverRegistrationSteps({ phone = "" }) {
  /*
   * =========================================================
   * STEP CONTROL
   * =========================================================
   */

  const [stepIdx, setStepIdx] = useState(0);


  /*
   * =========================================================
   * GENERAL STATE
   * =========================================================
   */

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");


  /*
   * =========================================================
   * PROFILE PHOTO
   * =========================================================
   */

  const [photoUrl, setPhotoUrl] = useState("");

  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);


  /*
   * =========================================================
   * PERSONAL DETAILS
   * =========================================================
   */

  const [personal, setPersonal] = useState({
    full_name: "",
    phone: phone || "",
  });


  /*
   * =========================================================
   * DRIVER DETAILS
   * =========================================================
   */

  const [driver, setDriver] = useState({
    license_number: "",
    license_expiry: "",
    driving_experience_years: "",
  });


  /*
   * =========================================================
   * VEHICLE DETAILS
   * =========================================================
   */

  const [vehicle, setVehicle] = useState({
    make: "",
    model: "",
    year: "",
    registration_number: "",
    vehicle_type: "minibus",
    seating_capacity: "",
    luggage_capacity: "",
  });


  /*
   * =========================================================
   * ROUTES
   * =========================================================
   */

  const [routes, setRoutes] = useState([]);

  const [routeOrigin, setRouteOrigin] =
    useState("");

  const [routeDest, setRouteDest] =
    useState("");


  /*
   * =========================================================
   * PHOTO UPLOAD
   * =========================================================
   */

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingPhoto(true);
    setError("");

    try {
      const result =
        await base44.integrations.Core.UploadFile({
          file,
        });

      if (!result?.file_url) {
        throw new Error(
          "The photo could not be uploaded."
        );
      }

      setPhotoUrl(result.file_url);

      toast({
        title: "Photo uploaded",
        description:
          "Your profile photo has been added.",
      });
    } catch (err) {
      console.error(
        "DRIVER PHOTO UPLOAD ERROR:",
        err
      );

      setError(
        err?.message ||
          "Could not upload profile photo."
      );
    } finally {
      setUploadingPhoto(false);
    }
  };


  /*
   * =========================================================
   * ADD ROUTE
   * =========================================================
   */

  const addRoute = () => {
    setError("");

    if (!routeOrigin || !routeDest) {
      setError(
        "Please select both the From town and To town."
      );
      return;
    }

    if (routeOrigin === routeDest) {
      setError(
        "From town and To town must be different."
      );
      return;
    }

    const route = `${routeOrigin} - ${routeDest}`;

    if (routes.includes(route)) {
      setError(
        "This route has already been added."
      );
      return;
    }

    setRoutes((currentRoutes) => [
      ...currentRoutes,
      route,
    ]);

    setRouteOrigin("");
    setRouteDest("");
  };


  /*
   * =========================================================
   * REMOVE ROUTE
   * =========================================================
   */

  const removeRoute = (routeToRemove) => {
    setRoutes((currentRoutes) =>
      currentRoutes.filter(
        (route) => route !== routeToRemove
      )
    );
  };


  /*
   * =========================================================
   * VALIDATE CURRENT STEP
   * =========================================================
   */

  const validateStep = () => {
    setError("");


    /*
     * STEP 1 — PERSONAL
     */

    if (stepIdx === 0) {
      if (!personal.full_name.trim()) {
        setError(
          "Full name is required."
        );
        return false;
      }

      if (!personal.phone.trim()) {
        setError(
          "Mobile number is required."
        );
        return false;
      }
    }


    /*
     * STEP 2 — DRIVER
     */

    if (stepIdx === 1) {
      if (!driver.license_number.trim()) {
        setError(
          "Driver licence number is required."
        );
        return false;
      }

      if (!driver.license_expiry) {
        setError(
          "Driver licence expiry date is required."
        );
        return false;
      }
    }


    /*
     * STEP 3 — VEHICLE
     */

    if (stepIdx === 2) {
      if (!vehicle.make.trim()) {
        setError(
          "Vehicle make is required."
        );
        return false;
      }

      if (!vehicle.model.trim()) {
        setError(
          "Vehicle model is required."
        );
        return false;
      }

      if (
        !vehicle.registration_number.trim()
      ) {
        setError(
          "Vehicle registration number is required."
        );
        return false;
      }

      if (
        !vehicle.seating_capacity ||
        Number(vehicle.seating_capacity) <= 0
      ) {
        setError(
          "Passenger capacity is required."
        );
        return false;
      }
    }


    /*
     * STEP 4 — ROUTES
     */

    if (stepIdx === 3) {
      if (routes.length === 0) {
        setError(
          "Please add at least one town-to-town route."
        );
        return false;
      }
    }

    return true;
  };


  /*
   * =========================================================
   * NEXT STEP
   * =========================================================
   */

  const handleNext = () => {
    if (!validateStep()) {
      return;
    }

    if (
      stepIdx ===
      STEPS.length - 1
    ) {
      finishRegistration();
      return;
    }

    setStepIdx(
      (currentStep) =>
        Math.min(
          currentStep + 1,
          STEPS.length - 1
        )
    );
  };


  /*
   * =========================================================
   * PREVIOUS STEP
   * =========================================================
   */

  const handleBack = () => {
    setError("");

    setStepIdx(
      (currentStep) =>
        Math.max(currentStep - 1, 0)
    );
  };


  /*
   * =========================================================
   * COMPLETE DRIVER REGISTRATION
   * =========================================================
   */

  const finishRegistration = async () => {
    if (!validateStep()) {
      return;
    }

    setSubmitting(true);
    setError("");


    try {
      /*
       * -----------------------------------------------------
       * 1. VERIFY AUTHENTICATED BASE44 USER
       * -----------------------------------------------------
       */

      const authenticatedUser =
        await base44.auth.me();

      console.log(
        "TREBA DRIVER REGISTRATION USER:",
        authenticatedUser
      );

      if (!authenticatedUser?.id) {
        throw new Error(
          "Your account session could not be found. Please log in again."
        );
      }


      /*
       * -----------------------------------------------------
       * 2. UPDATE BASE44 USER
       * -----------------------------------------------------
       *
       * This keeps the authentication user as the
       * central account record.
       */

      await base44.auth.updateMe({
        app_role: "driver",
        full_name:
          personal.full_name.trim(),
        phone:
          personal.phone.trim(),
      });


      /*
       * -----------------------------------------------------
       * 3. CREATE VEHICLE
       * -----------------------------------------------------
       *
       * DriverProfile needs the vehicle ID.
       *
       * Vehicle.driver_id is initially set to the
       * authenticated user's ID.
       */

      const createdVehicle =
        await base44.entities.Vehicle.create({
          driver_id:
            authenticatedUser.id,

          make:
            vehicle.make.trim(),

          model:
            vehicle.model.trim(),

          year: vehicle.year
            ? Number(vehicle.year)
            : undefined,

          registration_number:
            vehicle.registration_number.trim(),

          vehicle_type:
            vehicle.vehicle_type,

          seating_capacity:
            Number(
              vehicle.seating_capacity
            ),

          luggage_capacity:
            Number(
              vehicle.luggage_capacity || 0
            ),

          verification_status:
            "pending",

          active: true,
        });


      if (!createdVehicle?.id) {
        throw new Error(
          "Vehicle registration could not be completed."
        );
      }


      /*
       * -----------------------------------------------------
       * 4. CREATE DRIVER PROFILE
       * -----------------------------------------------------
       */

      await base44.entities.DriverProfile.create({
        user_id:
          authenticatedUser.id,

        full_name:
          personal.full_name.trim(),

        phone:
          personal.phone.trim(),

        driver_status:
          "pending",

        availability_status:
          "available",

        preferred_routes:
          routes,

        rating: 0,

        rating_count: 0,

        trips_completed: 0,

        maximum_trips_per_day: 2,

        minimum_rest_hours: 8,

        scheduling_score: 0,

        fatigue_score: 0,

        fairness_score: 0,
      });


      /*
       * -----------------------------------------------------
       * 5. REGISTRATION COMPLETE
       * -----------------------------------------------------
       */

      console.log(
        "TREBA DRIVER REGISTRATION COMPLETE"
      );

      toast({
        title:
          "Driver registration submitted",
        description:
          "Your driver account is pending verification.",
      });


      /*
       * -----------------------------------------------------
       * 6. GO TO DRIVER DASHBOARD
       * -----------------------------------------------------
       */

      window.location.href =
        "/app/driver";

    } catch (err) {
      console.error(
        "TREBA DRIVER REGISTRATION ERROR:",
        err
      );

      console.error(
        "Error message:",
        err?.message
      );

      console.error(
        "Error response:",
        err?.response
      );

      console.error(
        "Error data:",
        err?.data
      );

      console.error(
        "Error status:",
        err?.status
      );

      setError(
        err?.message ||
          "Could not complete driver registration."
      );

    } finally {
      setSubmitting(false);
    }
  };


  /*
   * =========================================================
   * CURRENT STEP ICON
   * =========================================================
   */

  const StepIcon =
    STEPS[stepIdx].icon;


  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <AuthLayout
      icon={Car}
      title="Complete your driver registration"
      subtitle="Provide the information Treba needs to verify your driver account."
    >

      {/* -------------------------------------------------- */}
      {/* STEP INDICATOR */}
      {/* -------------------------------------------------- */}

      <ol className="mb-6 flex items-center gap-1">

        {STEPS.map((step, index) => {
          const Icon = step.icon;

          const active =
            index === stepIdx;

          const completed =
            index < stepIdx;

          return (
            <li
              key={step.key}
              className="flex items-center"
            >

              <span
                className={`
                  flex h-8 w-8
                  items-center justify-center
                  rounded-full
                  text-xs font-bold
                  ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : completed
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }
                `}
              >

                {completed ? (
                  "✓"
                ) : (
                  <Icon className="h-4 w-4" />
                )}

              </span>

              <span
                className={`
                  ml-1.5 text-xs font-medium
                  ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                `}
              >
                {step.label}
              </span>

              {index <
                STEPS.length - 1 && (
                <span className="mx-2 h-px w-4 bg-border" />
              )}

            </li>
          );
        })}

      </ol>


      {/* -------------------------------------------------- */}
      {/* ERROR */}
      {/* -------------------------------------------------- */}

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}


      {/* ================================================== */}
      {/* STEP 1 — PERSONAL */}
      {/* ================================================== */}

      {stepIdx === 0 && (
        <div className="space-y-5">

          {/* Profile photo */}

          <div className="flex items-center gap-4">

            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary">

              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Driver profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-7 w-7" />
              )}

            </div>

            <div>

              <input
                id="driverPhoto"
                type="file"
                accept="image/*"
                onChange={handlePhoto}
                className="hidden"
              />

              <Label
                htmlFor="driverPhoto"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >

                {uploadingPhoto ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}

                {photoUrl
                  ? "Change photo"
                  : "Add photo"}

              </Label>

            </div>

          </div>


          {/* Full name */}

          <div className="space-y-2">

            <Label htmlFor="driverFullName">
              Full name
            </Label>

            <Input
              id="driverFullName"
              value={
                personal.full_name
              }
              onChange={(event) =>
                setPersonal({
                  ...personal,
                  full_name:
                    event.target.value,
                })
              }
              placeholder="Full name"
              className="h-11"
              required
            />

          </div>


          {/* Mobile */}

          <div className="space-y-2">

            <Label htmlFor="driverPhone">
              Mobile number
            </Label>

            <Input
              id="driverPhone"
              type="tel"
              value={personal.phone}
              onChange={(event) =>
                setPersonal({
                  ...personal,
                  phone:
                    event.target.value,
                })
              }
              placeholder="081 123 4567"
              className="h-11"
              required
            />

          </div>

        </div>
      )}


      {/* ================================================== */}
      {/* STEP 2 — DRIVER */}
      {/* ================================================== */}

      {stepIdx === 1 && (
        <div className="space-y-5">

          <div className="space-y-2">

            <Label htmlFor="licenseNumber">
              Driver licence number
            </Label>

            <Input
              id="licenseNumber"
              value={
                driver.license_number
              }
              onChange={(event) =>
                setDriver({
                  ...driver,
                  license_number:
                    event.target.value,
                })
              }
              className="h-11"
              required
            />

          </div>


          <div className="space-y-2">

            <Label htmlFor="licenseExpiry">
              Licence expiry
            </Label>

            <Input
              id="licenseExpiry"
              type="date"
              value={
                driver.license_expiry
              }
              onChange={(event) =>
                setDriver({
                  ...driver,
                  license_expiry:
                    event.target.value,
                })
              }
              className="h-11"
              required
            />

          </div>


          <div className="space-y-2">

            <Label htmlFor="experience">
              Driving experience (years)
            </Label>

            <Input
              id="experience"
              type="number"
              min="0"
              value={
                driver.driving_experience_years
              }
              onChange={(event) =>
                setDriver({
                  ...driver,
                  driving_experience_years:
                    event.target.value,
                })
              }
              className="h-11"
            />

          </div>


          <p className="text-xs text-muted-foreground">
            Your driver account will remain
            pending until Treba completes
            verification.
          </p>

        </div>
      )}


      {/* ================================================== */}
      {/* STEP 3 — VEHICLE */}
      {/* ================================================== */}

      {stepIdx === 2 && (
        <div className="space-y-5">

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            <div className="space-y-2">

              <Label>
                Make
              </Label>

              <Input
                value={vehicle.make}
                onChange={(event) =>
                  setVehicle({
                    ...vehicle,
                    make:
                      event.target.value,
                  })
                }
                placeholder="Toyota"
                className="h-11"
                required
              />

            </div>


            <div className="space-y-2">

              <Label>
                Model
              </Label>

              <Input
                value={vehicle.model}
                onChange={(event) =>
                  setVehicle({
                    ...vehicle,
                    model:
                      event.target.value,
                  })
                }
                placeholder="Quantum"
                className="h-11"
                required
              />

            </div>

          </div>


          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            <div className="space-y-2">

              <Label>
                Registration number
              </Label>

              <Input
                value={
                  vehicle.registration_number
                }
                onChange={(event) =>
                  setVehicle({
                    ...vehicle,
                    registration_number:
                      event.target.value,
                  })
                }
                placeholder="N 12345 W"
                className="h-11"
                required
              />

            </div>


            <div className="space-y-2">

              <Label>
                Vehicle type
              </Label>

              <Select
                value={
                  vehicle.vehicle_type
                }
                onValueChange={(value) =>
                  setVehicle({
                    ...vehicle,
                    vehicle_type:
                      value,
                  })
                }
              >

                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>

                  {VEHICLE_TYPES.map(
                    (type) => (
                      <SelectItem
                        key={type.value}
                        value={type.value}
                      >
                        {type.label}
                      </SelectItem>
                    )
                  )}

                </SelectContent>

              </Select>

            </div>

          </div>


          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            <div className="space-y-2">

              <Label>
                Year
              </Label>

              <Input
                type="number"
                min="1900"
                value={vehicle.year}
                onChange={(event) =>
                  setVehicle({
                    ...vehicle,
                    year:
                      event.target.value,
                  })
                }
                className="h-11"
              />

            </div>


            <div className="space-y-2">

              <Label>
                Passenger capacity
              </Label>

              <Input
                type="number"
                min="1"
                value={
                  vehicle.seating_capacity
                }
                onChange={(event) =>
                  setVehicle({
                    ...vehicle,
                    seating_capacity:
                      event.target.value,
                  })
                }
                className="h-11"
                required
              />

            </div>


            <div className="space-y-2">

              <Label>
                Luggage capacity
              </Label>

              <Input
                type="number"
                min="0"
                value={
                  vehicle.luggage_capacity
                }
                onChange={(event) =>
                  setVehicle({
                    ...vehicle,
                    luggage_capacity:
                      event.target.value,
                  })
                }
                className="h-11"
              />

            </div>

          </div>

        </div>
      )}


      {/* ================================================== */}
      {/* STEP 4 — ROUTES */}
      {/* ================================================== */}

      {stepIdx === 3 && (
        <div className="space-y-5">

          <p className="text-sm text-muted-foreground">
            Select the town-to-town corridors you
            are willing to operate. Treba will use
            these routes when matching passenger
            requests.
          </p>


          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">

            {/* FROM */}

            <Select
              value={routeOrigin}
              onValueChange={
                setRouteOrigin
              }
            >

              <SelectTrigger className="h-11">
                <SelectValue placeholder="From town" />
              </SelectTrigger>

              <SelectContent>

                {NAMIBIAN_TOWNS.map(
                  (town) => (
                    <SelectItem
                      key={town}
                      value={town}
                    >
                      {town}
                    </SelectItem>
                  )
                )}

              </SelectContent>

            </Select>


            {/* TO */}

            <Select
              value={routeDest}
              onValueChange={
                setRouteDest
              }
            >

              <SelectTrigger className="h-11">
                <SelectValue placeholder="To town" />
              </SelectTrigger>

              <SelectContent>

                {NAMIBIAN_TOWNS.map(
                  (town) => (
                    <SelectItem
                      key={town}
                      value={town}
                    >
                      {town}
                    </SelectItem>
                  )
                )}

              </SelectContent>

            </Select>


            {/* ADD */}

            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={addRoute}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>

          </div>


          {/* ROUTE LIST */}

          {routes.length > 0 && (
            <ul className="space-y-2">

              {routes.map((route) => (
                <li
                  key={route}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                >

                  <RouteIcon className="h-4 w-4 text-primary" />

                  <span className="text-sm font-medium">
                    {route}
                  </span>

                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      removeRoute(route)
                    }
                  >
                    <X className="h-4 w-4" />
                  </button>

                </li>
              ))}

            </ul>
          )}

        </div>
      )}


      {/* ================================================== */}
      {/* NAVIGATION */}
      {/* ================================================== */}

      <div className="mt-6 flex items-center justify-between">

        <Button
          type="button"
          variant="ghost"
          onClick={handleBack}
          disabled={
            stepIdx === 0 ||
            submitting
          }
        >
          Back
        </Button>


        <Button
          type="button"
          onClick={handleNext}
          disabled={
            submitting ||
            uploadingPhoto
          }
          className="h-11 px-6"
        >

          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : stepIdx ===
            STEPS.length - 1 ? (
            "Submit registration"
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}

        </Button>

      </div>

    </AuthLayout>
  );
}