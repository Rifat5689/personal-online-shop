import React from "react";
import { AppProviders } from "./application/providers/AppProviders";
import { AppRoutes } from "./application/routes";

function App(props) {
  return (
    <AppProviders {...props}>
      <AppRoutes />
    </AppProviders>
  );
}

export default App;
