import React from "react";
import { Link } from "react-router-dom";
import { TbChevronRight } from "react-icons/tb";
import { useCatalog } from "../../../features/store/hooks/useCatalog";
import { QueryState } from "../../../components/common/QueryState";

export default function Categories() {
  const { categories, products, storeSlug } = useCatalog();
  return (
    <div className="shop-container ob-catalog-categories">
      <div className="ob-page-heading"><h1>Categories</h1></div>

      <QueryState query={categories} empty={categories.data?.length === 0}>
        <div className="ob-category-list">
          {categories.data?.map((category) => {
            const matches = products.data?.filter((product) => product.category?.slug === category.slug) || [];
            const isOrigins = storeSlug === "originsofbeauty";
            const productImage = matches.find(product => product.images?.some(photo => photo.url))?.images.find(photo => photo.url)?.url;
            const categoryPhoto = !category.image?.url && !productImage && isOrigins && ["makeup", "fragrance", "bodycare"].includes(category.slug);
            const image = category.image?.url || productImage || (isOrigins && category.slug === "skincare" ? "/images/skincare-category.png" : null);
            return <Link key={category._id} to={`/categories/${category.slug}`} className="ob-category-tile">
              <span><strong>{category.name}</strong><small>{matches.length} products</small></span>
              {categoryPhoto && <span className={`ob-category-tile-photo ob-category-tile-${category.slug}`} aria-hidden="true" />}
              {image && <img src={image} alt="" loading="lazy" />}
              <TbChevronRight aria-hidden="true" />
            </Link>;
          })}
        </div>
      </QueryState>
    </div>
  );
}
