import React from "react";
import ReactDOM from "react-dom/client";
import { Admin, Resource, ListGuesser } from "react-admin";
import fakeDataProvider from "ra-data-fakerest";

// Placeholder data provider - will be replaced with tRPC adapter
const dataProvider = fakeDataProvider({
  events: [
    { id: 1, title: "Sample Event", status: "RAW" },
  ],
  entities: [
    { id: 1, name: "Anthropic", type: "COMPANY" },
  ],
});

function App() {
  return (
    <Admin dataProvider={dataProvider}>
      <Resource name="events" list={ListGuesser} />
      <Resource name="entities" list={ListGuesser} />
    </Admin>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
