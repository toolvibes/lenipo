from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="RestrictedPage")



@_attrs_define
class RestrictedPage:
    """ 
        Attributes:
            id (UUID):
            title (str):
            view (bool):
            edit (bool):
     """

    id: UUID
    title: str
    view: bool
    edit: bool





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        title = self.title

        view = self.view

        edit = self.edit


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "title": title,
            "view": view,
            "edit": edit,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        title = d.pop("title")

        view = d.pop("view")

        edit = d.pop("edit")

        restricted_page = cls(
            id=id,
            title=title,
            view=view,
            edit=edit,
        )

        return restricted_page

