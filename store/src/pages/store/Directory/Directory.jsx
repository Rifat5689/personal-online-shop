import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { request } from "../../../services/api";
import { QueryState } from "../../../components/common/QueryState";
export default function Directory() {
  const query = useQuery({
    queryKey: ["publicStores"],
    queryFn: () => request("get", "/stores/public"),
  });
  return (
    <div className="shop-container directory">
      <div className="section-heading">
        <div>
          <h1>OwnShop</h1>
          <p>Discover our stores</p>
        </div>
      </div>
      <QueryState query={query} empty={query.data?.length === 0}>
        <div className="category-grid">
          {query.data?.map((store) => (
            <Link className="card" key={store._id} to={`/${store.slug}`}>
              <h2>{store.name}</h2>
              <p>{store.description}</p>
              <span>Visit Store →</span>
            </Link>
          ))}
        </div>
      </QueryState>
    </div>
  );
}
