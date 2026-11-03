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
  from ..models.transition_rules_input import TransitionRulesInput





T = TypeVar("T", bound="PublishWorkflowRequestInputStatusesItem")



@_attrs_define
class PublishWorkflowRequestInputStatusesItem:
    """ 
        Attributes:
            id (None | UUID):
            name (str):
            category (StatusCategory):
            rules (TransitionRulesInput | Unset):
     """

    id: None | UUID
    name: str
    category: StatusCategory
    rules: TransitionRulesInput | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.transition_rules_input import TransitionRulesInput # noqa: PLC0415
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
        field_dict.update(self.additional_properties)
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
        from ..models.transition_rules_input import TransitionRulesInput # noqa: PLC0415
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
        rules: TransitionRulesInput | Unset
        if isinstance(_rules,  Unset):
            rules = UNSET
        else:
            rules = TransitionRulesInput.from_dict(_rules)




        publish_workflow_request_input_statuses_item = cls(
            id=id,
            name=name,
            category=category,
            rules=rules,
        )


        publish_workflow_request_input_statuses_item.additional_properties = d
        return publish_workflow_request_input_statuses_item

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
