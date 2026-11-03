from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.search_match_in import SearchMatchIn
from typing import cast

if TYPE_CHECKING:
  from ..models.snippet_item import SnippetItem





T = TypeVar("T", bound="SearchMatch")



@_attrs_define
class SearchMatch:
    """ 
        Attributes:
            in_ (SearchMatchIn):
            author (None | str):
            snippet (list[SnippetItem]):
     """

    in_: SearchMatchIn
    author: None | str
    snippet: list[SnippetItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.snippet_item import SnippetItem # noqa: PLC0415
        in_ = self.in_.value

        author: None | str
        author = self.author

        snippet = []
        for componentsschemas_snippet_item_data in self.snippet:
            componentsschemas_snippet_item = componentsschemas_snippet_item_data.to_dict()
            snippet.append(componentsschemas_snippet_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "in": in_,
            "author": author,
            "snippet": snippet,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.snippet_item import SnippetItem # noqa: PLC0415
        d = dict(src_dict)
        in_ = SearchMatchIn(d.pop("in"))




        def _parse_author(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        author = _parse_author(d.pop("author"))


        snippet = []
        _snippet = d.pop("snippet")
        for componentsschemas_snippet_item_data in (_snippet):
            componentsschemas_snippet_item = SnippetItem.from_dict(componentsschemas_snippet_item_data)



            snippet.append(componentsschemas_snippet_item)


        search_match = cls(
            in_=in_,
            author=author,
            snippet=snippet,
        )

        return search_match

