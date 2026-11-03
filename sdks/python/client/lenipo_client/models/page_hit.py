from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.page_hit_space import PageHitSpace
  from ..models.search_match import SearchMatch
  from ..models.snippet_item import SnippetItem





T = TypeVar("T", bound="PageHit")



@_attrs_define
class PageHit:
    """ 
        Attributes:
            id (UUID):
            title (str):
            space (PageHitSpace):
            parent_title (None | str):
            published_at (datetime.datetime | None):
            snippet (list[SnippetItem]):
            match (SearchMatch | Unset):
     """

    id: UUID
    title: str
    space: PageHitSpace
    parent_title: None | str
    published_at: datetime.datetime | None
    snippet: list[SnippetItem]
    match: SearchMatch | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.page_hit_space import PageHitSpace # noqa: PLC0415
        from ..models.search_match import SearchMatch # noqa: PLC0415
        from ..models.snippet_item import SnippetItem # noqa: PLC0415
        id = str(self.id)

        title = self.title

        space = self.space.to_dict()

        parent_title: None | str
        parent_title = self.parent_title

        published_at: None | str
        if isinstance(self.published_at, datetime.datetime):
            published_at = self.published_at.isoformat()
        else:
            published_at = self.published_at

        snippet = []
        for componentsschemas_snippet_item_data in self.snippet:
            componentsschemas_snippet_item = componentsschemas_snippet_item_data.to_dict()
            snippet.append(componentsschemas_snippet_item)



        match: dict[str, Any] | Unset = UNSET
        if not isinstance(self.match, Unset):
            match = self.match.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "title": title,
            "space": space,
            "parentTitle": parent_title,
            "publishedAt": published_at,
            "snippet": snippet,
        })
        if match is not UNSET:
            field_dict["match"] = match

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.page_hit_space import PageHitSpace # noqa: PLC0415
        from ..models.search_match import SearchMatch # noqa: PLC0415
        from ..models.snippet_item import SnippetItem # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        title = d.pop("title")

        space = PageHitSpace.from_dict(d.pop("space"))




        def _parse_parent_title(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        parent_title = _parse_parent_title(d.pop("parentTitle"))


        def _parse_published_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                published_at_type_0 = datetime.datetime.fromisoformat(data)



                return published_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        published_at = _parse_published_at(d.pop("publishedAt"))


        snippet = []
        _snippet = d.pop("snippet")
        for componentsschemas_snippet_item_data in (_snippet):
            componentsschemas_snippet_item = SnippetItem.from_dict(componentsschemas_snippet_item_data)



            snippet.append(componentsschemas_snippet_item)


        _match = d.pop("match", UNSET)
        match: SearchMatch | Unset
        if isinstance(_match,  Unset):
            match = UNSET
        else:
            match = SearchMatch.from_dict(_match)




        page_hit = cls(
            id=id,
            title=title,
            space=space,
            parent_title=parent_title,
            published_at=published_at,
            snippet=snippet,
            match=match,
        )

        return page_hit

