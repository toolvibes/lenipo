from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_role import ProjectRole
from ..models.transition_rules_input_assign import TransitionRulesInputAssign
from ..models.transition_rules_input_comment import TransitionRulesInputComment
from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.transition_field_action_input import TransitionFieldActionInput





T = TypeVar("T", bound="TransitionRulesInput")



@_attrs_define
class TransitionRulesInput:
    """ 
        Attributes:
            only_assignee (bool | Unset):  Default: False.
            roles (list[ProjectRole] | Unset):
            subtasks_done (bool | Unset):  Default: False.
            blockers_done (bool | Unset):  Default: False.
            required_fields (list[str] | Unset):
            due_not_past (bool | Unset):  Default: False.
            assign (TransitionRulesInputAssign | Unset):  Default: TransitionRulesInputAssign.KEEP.
            field_actions (list[TransitionFieldActionInput] | Unset):
            watch (bool | Unset):  Default: False.
            screen (bool | Unset):  Default: False.
            comment (TransitionRulesInputComment | Unset):  Default: TransitionRulesInputComment.NONE.
     """

    only_assignee: bool | Unset = False
    roles: list[ProjectRole] | Unset = UNSET
    subtasks_done: bool | Unset = False
    blockers_done: bool | Unset = False
    required_fields: list[str] | Unset = UNSET
    due_not_past: bool | Unset = False
    assign: TransitionRulesInputAssign | Unset = TransitionRulesInputAssign.KEEP
    field_actions: list[TransitionFieldActionInput] | Unset = UNSET
    watch: bool | Unset = False
    screen: bool | Unset = False
    comment: TransitionRulesInputComment | Unset = TransitionRulesInputComment.NONE
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.transition_field_action_input import TransitionFieldActionInput # noqa: PLC0415
        only_assignee = self.only_assignee

        roles: list[str] | Unset = UNSET
        if not isinstance(self.roles, Unset):
            roles = []
            for roles_item_data in self.roles:
                roles_item = roles_item_data.value
                roles.append(roles_item)



        subtasks_done = self.subtasks_done

        blockers_done = self.blockers_done

        required_fields: list[str] | Unset = UNSET
        if not isinstance(self.required_fields, Unset):
            required_fields = self.required_fields



        due_not_past = self.due_not_past

        assign: str | Unset = UNSET
        if not isinstance(self.assign, Unset):
            assign = self.assign.value


        field_actions: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.field_actions, Unset):
            field_actions = []
            for field_actions_item_data in self.field_actions:
                field_actions_item = field_actions_item_data.to_dict()
                field_actions.append(field_actions_item)



        watch = self.watch

        screen = self.screen

        comment: str | Unset = UNSET
        if not isinstance(self.comment, Unset):
            comment = self.comment.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if only_assignee is not UNSET:
            field_dict["onlyAssignee"] = only_assignee
        if roles is not UNSET:
            field_dict["roles"] = roles
        if subtasks_done is not UNSET:
            field_dict["subtasksDone"] = subtasks_done
        if blockers_done is not UNSET:
            field_dict["blockersDone"] = blockers_done
        if required_fields is not UNSET:
            field_dict["requiredFields"] = required_fields
        if due_not_past is not UNSET:
            field_dict["dueNotPast"] = due_not_past
        if assign is not UNSET:
            field_dict["assign"] = assign
        if field_actions is not UNSET:
            field_dict["fieldActions"] = field_actions
        if watch is not UNSET:
            field_dict["watch"] = watch
        if screen is not UNSET:
            field_dict["screen"] = screen
        if comment is not UNSET:
            field_dict["comment"] = comment

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.transition_field_action_input import TransitionFieldActionInput # noqa: PLC0415
        d = dict(src_dict)
        only_assignee = d.pop("onlyAssignee", UNSET)

        _roles = d.pop("roles", UNSET)
        roles: list[ProjectRole] | Unset = UNSET
        if _roles is not UNSET:
            roles = []
            for roles_item_data in _roles:
                roles_item = ProjectRole(roles_item_data)



                roles.append(roles_item)


        subtasks_done = d.pop("subtasksDone", UNSET)

        blockers_done = d.pop("blockersDone", UNSET)

        required_fields = cast(list[str], d.pop("requiredFields", UNSET))


        due_not_past = d.pop("dueNotPast", UNSET)

        _assign = d.pop("assign", UNSET)
        assign: TransitionRulesInputAssign | Unset
        if isinstance(_assign,  Unset):
            assign = UNSET
        else:
            assign = TransitionRulesInputAssign(_assign)




        _field_actions = d.pop("fieldActions", UNSET)
        field_actions: list[TransitionFieldActionInput] | Unset = UNSET
        if _field_actions is not UNSET:
            field_actions = []
            for field_actions_item_data in _field_actions:
                field_actions_item = TransitionFieldActionInput.from_dict(field_actions_item_data)



                field_actions.append(field_actions_item)


        watch = d.pop("watch", UNSET)

        screen = d.pop("screen", UNSET)

        _comment = d.pop("comment", UNSET)
        comment: TransitionRulesInputComment | Unset
        if isinstance(_comment,  Unset):
            comment = UNSET
        else:
            comment = TransitionRulesInputComment(_comment)




        transition_rules_input = cls(
            only_assignee=only_assignee,
            roles=roles,
            subtasks_done=subtasks_done,
            blockers_done=blockers_done,
            required_fields=required_fields,
            due_not_past=due_not_past,
            assign=assign,
            field_actions=field_actions,
            watch=watch,
            screen=screen,
            comment=comment,
        )


        transition_rules_input.additional_properties = d
        return transition_rules_input

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
