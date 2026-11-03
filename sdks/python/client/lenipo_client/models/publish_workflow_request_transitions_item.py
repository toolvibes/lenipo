from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="PublishWorkflowRequestTransitionsItem")



@_attrs_define
class PublishWorkflowRequestTransitionsItem:
    """ 
        Attributes:
            from_ (int):
            to (int):
     """

    from_: int
    to: int





    def to_dict(self) -> dict[str, Any]:
        from_ = self.from_

        to = self.to


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "from": from_,
            "to": to,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        from_ = d.pop("from")

        to = d.pop("to")

        publish_workflow_request_transitions_item = cls(
            from_=from_,
            to=to,
        )

        return publish_workflow_request_transitions_item

