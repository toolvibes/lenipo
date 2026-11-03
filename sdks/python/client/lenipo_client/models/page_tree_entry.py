from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="PageTreeEntry")



@_attrs_define
class PageTreeEntry:
    """ 
        Attributes:
            id (UUID):
            parent_id (None | UUID):
            title (str):
            published (bool):
     """

    id: UUID
    parent_id: None | UUID
    title: str
    published: bool





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        parent_id: None | str
        if isinstance(self.parent_id, UUID):
            parent_id = str(self.parent_id)
        else:
            parent_id = self.parent_id

        title = self.title

        published = self.published


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "parentId": parent_id,
            "title": title,
            "published": published,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_parent_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parent_id_type_0 = UUID(data)



                return parent_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        parent_id = _parse_parent_id(d.pop("parentId"))


        title = d.pop("title")

        published = d.pop("published")

        page_tree_entry = cls(
            id=id,
            parent_id=parent_id,
            title=title,
            published=published,
        )

        return page_tree_entry

