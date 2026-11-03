from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="ProjectWorkflowTransitionsItem")



@_attrs_define
class ProjectWorkflowTransitionsItem:
    """ 
        Attributes:
            from_ (UUID):
            to (UUID):
     """

    from_: UUID
    to: UUID





    def to_dict(self) -> dict[str, Any]:
        from_ = str(self.from_)

        to = str(self.to)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "from": from_,
            "to": to,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        from_ = UUID(d.pop("from"))




        to = UUID(d.pop("to"))




        project_workflow_transitions_item = cls(
            from_=from_,
            to=to,
        )

        return project_workflow_transitions_item

