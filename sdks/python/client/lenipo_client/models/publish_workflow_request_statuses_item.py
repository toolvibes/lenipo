from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.status_category import StatusCategory
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.transition_rules import TransitionRules





T = TypeVar("T", bound="PublishWorkflowRequestStatusesItem")



@_attrs_define
class PublishWorkflowRequestStatusesItem:
    """ 
        Attributes:
            id (None | UUID):
            name (str):
            category (StatusCategory):
            rules (TransitionRules | Unset):
     """

    id: None | UUID
    name: str
    category: StatusCategory
    rules: TransitionRules | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.transition_rules import TransitionRules # noqa: PLC0415
        id: None | str
        if isinstance(self.id, UUID):
            id = str(self.id)
        else:
            id = self.id

        name = self.name

        category = self.category.value

        rules: dict[str, Any] | Unset = UNSET
        if not isinstance(self.rules, Unset):
            rules = self.rules.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "category": category,
        })
        if rules is not UNSET:
            field_dict["rules"] = rules

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.transition_rules import TransitionRules # noqa: PLC0415
        d = dict(src_dict)
        def _parse_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                id_type_0 = UUID(data)



                return id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        id = _parse_id(d.pop("id"))


        name = d.pop("name")

        category = StatusCategory(d.pop("category"))




        _rules = d.pop("rules", UNSET)
        rules: TransitionRules | Unset
        if isinstance(_rules,  Unset):
            rules = UNSET
        else:
            rules = TransitionRules.from_dict(_rules)




        publish_workflow_request_statuses_item = cls(
            id=id,
            name=name,
            category=category,
            rules=rules,
        )

        return publish_workflow_request_statuses_item

