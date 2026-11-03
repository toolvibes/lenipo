from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.favourite_kind import FavouriteKind
from ..types import UNSET, Unset
from uuid import UUID






T = TypeVar("T", bound="Favourite")



@_attrs_define
class Favourite:
    """ 
        Attributes:
            kind (FavouriteKind):
            id (UUID):
            ref (str):
            name (str):
            space_key (str | Unset):
            project_key (str | Unset):
     """

    kind: FavouriteKind
    id: UUID
    ref: str
    name: str
    space_key: str | Unset = UNSET
    project_key: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        id = str(self.id)

        ref = self.ref

        name = self.name

        space_key = self.space_key

        project_key = self.project_key


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "id": id,
            "ref": ref,
            "name": name,
        })
        if space_key is not UNSET:
            field_dict["spaceKey"] = space_key
        if project_key is not UNSET:
            field_dict["projectKey"] = project_key

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = FavouriteKind(d.pop("kind"))




        id = UUID(d.pop("id"))




        ref = d.pop("ref")

        name = d.pop("name")

        space_key = d.pop("spaceKey", UNSET)

        project_key = d.pop("projectKey", UNSET)

        favourite = cls(
            kind=kind,
            id=id,
            ref=ref,
            name=name,
            space_key=space_key,
            project_key=project_key,
        )

        return favourite

