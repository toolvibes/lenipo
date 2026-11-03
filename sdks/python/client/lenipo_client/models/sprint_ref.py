from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.sprint_ref_state import SprintRefState
from uuid import UUID






T = TypeVar("T", bound="SprintRef")



@_attrs_define
class SprintRef:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (SprintRefState):
     """

    id: UUID
    name: str
    state: SprintRefState





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        state = self.state.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "state": state,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = SprintRefState(d.pop("state"))




        sprint_ref = cls(
            id=id,
            name=name,
            state=state,
        )

        return sprint_ref

