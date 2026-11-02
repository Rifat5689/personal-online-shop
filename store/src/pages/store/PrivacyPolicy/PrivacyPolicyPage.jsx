import React from "react";
import { PageMetadata } from "../../../components/common/PageMetadata";
import { PolicyDocument, policyTitle, policyDescription } from "./policyDocument.js";
import "./privacy-policy.css";

export default function PrivacyPolicyPage() {
  return <><PageMetadata title={policyTitle} description={policyDescription} /><PolicyDocument /></>;
}
