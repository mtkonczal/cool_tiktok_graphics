import React from "react";
import { AbsoluteFill } from "remotion";
import "./fonts";
import { CardBody, CardBodyProps, CARD_FRAME } from "./CardBody";

export const FPS = 30;

export type CardProps = CardBodyProps;

export const Card: React.FC<CardProps> = ({ eyebrowText, headline, fontSize }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#191510" }}>
      <CardBody eyebrowText={eyebrowText} headline={headline} fontSize={fontSize} />
    </AbsoluteFill>
  );
};

export { CARD_FRAME };
