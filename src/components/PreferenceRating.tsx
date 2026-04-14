import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { RatingButtons, type Rating } from "@/components/RatingButtons";

interface PreferenceRatingAuthProps {
  mode: "auth";
  outputId: Id<"runOutputs">;
  runId: Id<"promptRuns">;
}

interface PreferenceRatingEvalProps {
  mode: "eval";
  opaqueToken: string;
  blindLabel: string;
}

type PreferenceRatingProps = PreferenceRatingAuthProps | PreferenceRatingEvalProps;

export function PreferenceRating(props: PreferenceRatingProps) {
  if (props.mode === "auth") {
    return <AuthPreferenceRating {...props} />;
  }
  return <EvalPreferenceRating {...props} />;
}

function AuthPreferenceRating({ outputId, runId }: PreferenceRatingAuthProps) {
  const myRatings = useQuery(api.outputPreferences.getMyRatingsForRun, { runId });
  const rateOutput = useMutation(api.outputPreferences.rateOutput);
  const clearRating = useMutation(api.outputPreferences.clearRating);

  const currentRating = myRatings?.find((r) => r.outputId === outputId)?.rating ?? null;

  const handleClick = async (rating: Rating) => {
    if (currentRating === rating) {
      await clearRating({ outputId });
    } else {
      await rateOutput({ outputId, rating });
    }
  };

  return <RatingButtons currentRating={currentRating} onRate={handleClick} />;
}

function EvalPreferenceRating({ opaqueToken, blindLabel }: PreferenceRatingEvalProps) {
  const myRatings = useQuery(api.outputPreferences.getMyRatingsByToken, { opaqueToken });
  const rateOutput = useMutation(api.outputPreferences.rateOutputByToken);
  const clearRating = useMutation(api.outputPreferences.clearRatingByToken);

  const currentRating = myRatings?.find((r) => r.blindLabel === blindLabel)?.rating ?? null;

  const handleClick = async (rating: Rating) => {
    if (currentRating === rating) {
      await clearRating({ opaqueToken, blindLabel });
    } else {
      await rateOutput({ opaqueToken, blindLabel, rating });
    }
  };

  return <RatingButtons currentRating={currentRating} onRate={handleClick} />;
}

